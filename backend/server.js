require('dotenv').config();

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { PDFDocument } from 'pdf-lib';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import path from 'path';

// Create express app
const app = express();

// Port from environment variable or default to 5001
const port = process.env.PORT || 5001;

// Enable CORS
app.use(cors());

// Create uploads directory if it doesn't exist
const uploadDir = process.env.UPLOAD_DIR || 'uploads/';
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir);
}

// Configure multer for file uploads
const upload = multer({ dest: uploadDir });

// Simple route to check if the server is running
app.get('/', (req, res) => {
  res.send('PDF Merger Backend is running.');
});

// Route to handle file uploads and PDF merging
app.post('/upload', upload.array('files'), async (req, res) => {
  try {
    const pdfDocs = [];
    for (const file of req.files) {
      const pdfDoc = await PDFDocument.load(readFileSync(file.path));
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
      writeFileSync('merged.pdf', mergedPdfBytes);
      console.log('Merged PDF saved successfully.');
    } catch (err) {
      console.error('Error saving PDF file:', err);
    }

    // Set headers and send the merged PDF
    res.setHeader('Content-Disposition', 'attachment; filename=merged.pdf');
    res.setHeader('Content-Type', 'application/pdf');
    res.send(Buffer.from(mergedPdfBytes));

    // Clean up uploaded files
    req.files.forEach(file => unlinkSync(file.path));
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('An error occurred while processing the PDF files.');
  }
});

// Start the server on specified port and host
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${port}`);
});
