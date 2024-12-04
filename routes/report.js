const express = require("express");
const router = express.Router();
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const TimeEntry = require("../models/timeEntry");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/monthly", authMiddleware(["admin", "rh"]), async (req, res) => {
  const { month, year } = req.query;

  try {
    const parsedMonth = parseInt(month, 10);
    const parsedYear = parseInt(year, 10);

    if (isNaN(parsedMonth) || isNaN(parsedYear) || parsedMonth < 1 || parsedMonth > 12) {
      return res.status(400).json({ message: "Mês ou ano inválidos." });
    }

    const startDate = new Date(parsedYear, parsedMonth - 1, 1);
    const endDate = new Date(parsedYear, parsedMonth, 0, 23, 59, 59);

    const timeEntries = await TimeEntry.find({
      employee: req.employee.id,
      timestamp: { $gte: startDate, $lte: endDate },
    }).sort({ timestamp: 1 });

    let totalHours = 0;
    let totalOvertime = 0;
    let warnings = [];
    let dailyHours = {};

    // Group entries by day
    timeEntries.forEach((entry) => {
      const day = new Date(entry.timestamp).toLocaleDateString();
      if (!dailyHours[day]) {
        dailyHours[day] = {
          entries: [],
          total: 0,
          overtime: 0
        };
      }
      dailyHours[day].entries.push(entry);
    });

    // Calculate hours and overtime for each day
    Object.keys(dailyHours).forEach(day => {
      const entries = dailyHours[day].entries;
      let dayTotal = 0;

      for (let i = 0; i < entries.length; i += 2) {
        if (entries[i + 1]) {
          const duration = entries[i + 1].timestamp - entries[i].timestamp;
          const hours = duration / (1000 * 60 * 60);
          dayTotal += hours;
        } else {
          warnings.push(`Registro ímpar encontrado no dia ${day}`);
        }
      }

      dailyHours[day].total = dayTotal;
      
      // Calculate overtime (hours worked beyond 8 hours)
      if (dayTotal > 8) {
        dailyHours[day].overtime = dayTotal - 8;
        totalOvertime += dayTotal - 8;
      }
      
      totalHours += dayTotal;
    });

    const doc = new PDFDocument();
    const fileName = `relatorio-${req.employee.id}-${month}-${year}.pdf`;
    const filePath = path.join(__dirname, "pdfs", fileName);

    if (!fs.existsSync(path.join(__dirname, "pdfs"))) {
      fs.mkdirSync(path.join(__dirname, "pdfs"));
    }

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const addHeader = () => {
      doc.fontSize(10).text(`PONTO`, { align: "center" });
      doc.text(`————————————————————————————————————————————————————————`);
      doc.text(
        `Empresa: PUC   Mes/Ano Competencia: ${parsedMonth}/${parsedYear}`
      );
      doc.text(`Endereco: AV. XXXX, XX   CNPJ: 17.178.195/0001-67`);
      doc.text(
        `Lotacao: PSG66074  - DIRETORIA DE EDUCAÇÃO CONTINUADA - IE  Atividade Economica: 00000 Hor. de Trab.: 2ªa6ª-08-12-13-17`
      );
      doc.text(
        `———————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————`
      );
      doc.text(
        `Funcionario: ${req.employee.name}   Categoria de Ponto: Geral PUC   Matricula: ${req.employee.matricula}`
      );
      doc.text(
        `———————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————`
      );
      doc.text(`Total de Horas Extras: ${totalOvertime.toFixed(2)}h`);
      doc.text(`———————————————————————————————————————————————————————`);
    };

    const addFooter = () => {
      doc
        .moveDown(2)
        .fontSize(8)
        .text(
          `Saldo Inicial: -01:43  Saldo Banco de Horas: -0:30  Créditos Mês: 06:10  Débitos Mês: 04:57`
        );
      doc.text(
        `———————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————`
      );
      doc
        .fontSize(8)
        .text(`Emissao: ${new Date().toLocaleString()}  Pagina: 0001`, {
          align: "right",
          baseline: "bottom",
        });
    };

    // Cabeçalho primeira pag
    addHeader();

    // Pontos registrados
    Object.keys(dailyHours).forEach(day => {
      const dayData = dailyHours[day];
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
