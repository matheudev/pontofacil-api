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
    // Mês / Ano
    const parsedMonth = parseInt(month, 10);
    const parsedYear = parseInt(year, 10);

    if (
      isNaN(parsedMonth) ||
      isNaN(parsedYear) ||
      parsedMonth < 1 ||
      parsedMonth > 12
    ) {
      return res.status(400).json({ message: "Mês ou ano inválidos." });
    }

    const startDate = new Date(parsedYear, parsedMonth - 1, 1);
    const endDate = new Date(parsedYear, parsedMonth, 0, 23, 59, 59); // Último dia do mês às 23:59:59

    const timeEntries = await TimeEntry.find({
      employee: req.employee.id,
      timestamp: { $gte: startDate, $lte: endDate },
    }).sort({ timestamp: 1 });

    let totalHours = 0;
    let warnings = [];

    for (let i = 0; i < timeEntries.length; i += 2) {
      if (timeEntries[i + 1]) {
        const duration =
          timeEntries[i + 1].timestamp - timeEntries[i].timestamp;
        totalHours += duration / (1000 * 60 * 60); // Convertendo para horas
      } else {
        warnings.push(
          `Registro ímpar encontrado no dia ${new Date(
            timeEntries[i].timestamp
          ).toLocaleDateString()}`
        );
      }
    }

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
    timeEntries.forEach((entry, index) => {
      doc.text(
        `Dia: ${new Date(entry.timestamp).toLocaleDateString()}   Entr: ${
          index % 2 === 0 ? new Date(entry.timestamp).toLocaleTimeString() : " "
        }   Saida: ${
          index % 2 !== 0 ? new Date(entry.timestamp).toLocaleTimeString() : " "
        }`
      );
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
