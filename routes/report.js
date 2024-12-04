const express = require("express");
const router = express.Router();
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const TimeEntry = require("../models/timeEntry");
const authMiddleware = require("../middleware/authMiddleware");
const Employee = require("../models/employee");
const Absence = require("../models/absence");

router.get("/monthly", authMiddleware(["admin", "rh"]), async (req, res) => {
  const { month, year } = req.query;
  let warnings = [];

  try {
    const parsedMonth = parseInt(month, 10);
    const parsedYear = parseInt(year, 10);

    if (isNaN(parsedMonth) || isNaN(parsedYear) || parsedMonth < 1 || parsedMonth > 12) {
      return res.status(400).json({ message: "Mês ou ano inválidos." });
    }

    const startDate = new Date(parsedYear, parsedMonth - 1, 1);
    const endDate = new Date(parsedYear, parsedMonth, 0, 23, 59, 59);

    // Get all employees from the company
    const employees = await Employee.find({ company: req.employee.company });
    
    let companyStats = {
      totalEmployees: employees.length,
      totalHours: 0,
      totalOvertime: 0,
      departmentStats: {},
      absenceCount: 0
    };

    // Get all time entries for the company
    const timeEntries = await TimeEntry.find({
      company: req.employee.company,
      timestamp: { $gte: startDate, $lte: endDate },
    }).populate('employee').sort({ timestamp: 1 });

    // Get all absences for the company
    const absences = await Absence.find({
      company: req.employee.company,
      date: { $gte: startDate, $lte: endDate },
    }).populate('employee');

    companyStats.absenceCount = absences.length;

    // Process department statistics
    employees.forEach(emp => {
      if (!companyStats.departmentStats[emp.department]) {
        companyStats.departmentStats[emp.department] = {
          employeeCount: 0,
          totalHours: 0,
          totalOvertime: 0,
          absences: 0
        };
      }
      companyStats.departmentStats[emp.department].employeeCount++;
    });

    // Group entries by employee and day
    let employeeStats = {};
    timeEntries.forEach((entry) => {
      const employeeId = entry.employee._id.toString();
      const day = new Date(entry.timestamp).toLocaleDateString();
      
      if (!employeeStats[employeeId]) {
        employeeStats[employeeId] = {
          name: entry.employee.name,
          department: entry.employee.department,
          dailyHours: {},
          totalHours: 0,
          totalOvertime: 0
        };
      }

      if (!employeeStats[employeeId].dailyHours[day]) {
        employeeStats[employeeId].dailyHours[day] = {
          entries: [],
          total: 0,
          overtime: 0
        };
      }
      employeeStats[employeeId].dailyHours[day].entries.push(entry);
    });

    // Calculate hours for each employee
    Object.keys(employeeStats).forEach(employeeId => {
      const employee = employeeStats[employeeId];
      const department = employee.department;

      Object.keys(employee.dailyHours).forEach(day => {
        const entries = employee.dailyHours[day].entries;
        let dayTotal = 0;

        for (let i = 0; i < entries.length; i += 2) {
          if (entries[i + 1]) {
            const duration = entries[i + 1].timestamp - entries[i].timestamp;
            const hours = duration / (1000 * 60 * 60);
            dayTotal += hours;
          }
        }

        employee.dailyHours[day].total = dayTotal;
        employee.totalHours += dayTotal;
        
        if (dayTotal > 8) {
          const overtime = dayTotal - 8;
          employee.dailyHours[day].overtime = overtime;
          employee.totalOvertime += overtime;
          companyStats.totalOvertime += overtime;
          companyStats.departmentStats[department].totalOvertime += overtime;
        }

        companyStats.totalHours += dayTotal;
        companyStats.departmentStats[department].totalHours += dayTotal;
      });
    });

    // Add warnings for incomplete entries
    Object.keys(employeeStats).forEach(employeeId => {
      const employee = employeeStats[employeeId];
      Object.keys(employee.dailyHours).forEach(day => {
        const entries = employee.dailyHours[day].entries;
        if (entries.length % 2 !== 0) {
          warnings.push(`${employee.name}: Registro incompleto no dia ${day}`);
        }
      });
    });

    // Add warnings for excessive hours
    Object.keys(employeeStats).forEach(employeeId => {
      const employee = employeeStats[employeeId];
      Object.keys(employee.dailyHours).forEach(day => {
        if (employee.dailyHours[day].total > 12) {
          warnings.push(`${employee.name}: Horas excessivas (${employee.dailyHours[day].total.toFixed(2)}h) no dia ${day}`);
        }
      });
    });

    // Create PDF report
    const doc = new PDFDocument();
    const fileName = `relatorio-${req.employee.id}-${month}-${year}.pdf`;
    const filePath = path.join(__dirname, "pdfs", fileName);

    if (!fs.existsSync(path.join(__dirname, "pdfs"))) {
      fs.mkdirSync(path.join(__dirname, "pdfs"));
    }

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const addHeader = () => {
      doc.fontSize(10).text(`RELATÓRIO DE PONTO`, { align: "center" });
      doc.text(`————————————————————————————————————————————————————————`);
      doc.text(
        `Empresa: ${req.employee.company.name}   Mes/Ano Competencia: ${parsedMonth}/${parsedYear}`
      );
      doc.text(`Endereco: ${req.employee.company.address}   CNPJ: ${req.employee.company.cnpj}`);
      doc.text(
        `Departamento: ${req.employee.department}  Horário de Trabalho: ${req.employee.workSchedule || "08:00-18:00"}`
      );
      doc.text(
        `———————————————————————————————————————————————————————————————————————————`
      );
      doc.text(
        `Funcionario: ${req.employee.name}   Cargo: ${req.employee.role}   Matricula: ${req.employee.matricula}`
      );
      doc.text(
        `———————————————————————————————————————————————————————————————————————————`
      );
    };

    const addFooter = () => {
      // Calculate monthly balance
      const monthlyBalance = calculateMonthlyBalance(employeeStats[req.employee._id]);
      
      doc
        .moveDown(2)
        .fontSize(8)
        .text(
          `Saldo Inicial: ${monthlyBalance.initialBalance}  Saldo Banco de Horas: ${monthlyBalance.overtimeBalance}  Créditos Mês: ${monthlyBalance.monthlyCredits}  Débitos Mês: ${monthlyBalance.monthlyDebits}`
        );
      doc.text(
        `———————————————————————————————————————————————————————————————————————————`
      );
      doc
        .fontSize(8)
        .text(`Emissao: ${new Date().toLocaleString()}  Pagina: ${doc.bufferedPageRange().count}`, {
          align: "right",
          baseline: "bottom",
        });
    };

    // Add this helper function to calculate monthly balance
    const calculateMonthlyBalance = (employeeData) => {
      if (!employeeData) {
        return {
          initialBalance: '00:00',
          overtimeBalance: '00:00',
          monthlyCredits: '00:00',
          monthlyDebits: '00:00'
        };
      }

      const totalWorkedHours = employeeData.totalHours;
      const expectedHours = 8 * 22; // 8 hours per day, 22 working days
      const overtime = employeeData.totalOvertime;

      const formatHours = (hours) => {
        const h = Math.floor(Math.abs(hours));
        const m = Math.floor((Math.abs(hours) - h) * 60);
        const sign = hours < 0 ? '-' : '';
        return `${sign}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      };

      return {
        initialBalance: formatHours(totalWorkedHours - expectedHours - overtime),
        overtimeBalance: formatHours(overtime),
        monthlyCredits: formatHours(Math.max(totalWorkedHours - expectedHours, 0)),
        monthlyDebits: formatHours(Math.max(expectedHours - totalWorkedHours, 0))
      };
    };

    // Cabeçalho primeira pag
    addHeader();

    // Pontos registrados
    Object.keys(employeeStats).forEach(employeeId => {
      const employee = employeeStats[employeeId];
      doc.text(`Funcionario: ${employee.name}`);
      doc.text(`Departamento: ${employee.department}`);
      Object.keys(employee.dailyHours).forEach(day => {
        const dayData = employee.dailyHours[day];
        doc.text(`Dia: ${day}`);
        dayData.entries.forEach((entry, index) => {
          doc.text(
            `${index % 2 === 0 ? 'Entrada:' : 'Saída:'} ${new Date(entry.timestamp).toLocaleTimeString()}`
          );
        });
        doc.text(`Total do dia: ${dayData.total.toFixed(2)}h`);
        if (dayData.overtime > 0) {
          doc.text(`Horas extras: ${dayData.overtime.toFixed(2)}h`);
        }
        doc.moveDown();
      });
      doc.moveDown();
    });

    // Rodape primeira pag
    addFooter();

    // Rodape para novas pags
    doc.on("pageAdded", () => {
      addHeader();
      addFooter();
    });

    if (warnings.length > 0) {
      doc
        .moveDown()
        .fontSize(12)
        .fillColor("red")
        .text("Avisos:", { underline: true });
      warnings.forEach((warning) => doc.text(warning));
    }

    // PDF
    doc.text(`CONFIRMO A FREQUENCIA ACIMA`);
    doc.moveDown().text(`Chefe / Gerente`, { align: "left" });
    doc.text(`Funcionario`, { align: "right" });

    doc.end();

    stream.on("finish", () => {
      res.download(filePath, fileName);
    });
  } catch (error) {
    console.error("Erro ao gerar o relatório:", error);
    res.status(500).json({ message: "Erro no servidor ao gerar o relatório." });
  }
});

module.exports = router;
