const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 5001;

app.use(cors());

const upload = multer({ dest: 'uploads/' });

app.get('/', (req, res) => {
  res.send('PDF Merger Backend is running.');
});

app.post('/upload', upload.array('files'), async (req, res) => {
  try {
    const pdfDocs = [];
    for (const file of req.files) {
      const pdfDoc = await PDFDocument.load(fs.readFileSync(file.path));
      pdfDocs.push(pdfDoc);
    }

    const mergedPdf = await PDFDocument.create();
    for (const pdfDoc of pdfDocs) {
      const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    let mergedPdfBytes;
    try {
      mergedPdfBytes = await mergedPdf.save();
      console.log('PDF generated successfully, bytes length:', mergedPdfBytes.length);
    } catch (err) {
      console.error('Error during PDF generation:', err);
      return res.status(500).send('Failed to generate PDF.');
    }

    // Save the merged PDF for inspection (optional)
    try {
      fs.writeFileSync('merged.pdf', mergedPdfBytes);
      console.log('Merged PDF saved successfully.');
    } catch (err) {
      console.error('Error saving PDF file:', err);
    }

    // Set headers and send the merged PDF
    res.setHeader('Content-Disposition', 'attachment; filename=merged.pdf');
    res.setHeader('Content-Type', 'application/pdf');
    res.send(Buffer.from(mergedPdfBytes));

    // Clean up uploaded files
    req.files.forEach(file => fs.unlinkSync(file.path));
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('An error occurred while processing the PDF files.');
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
