import React, { useState, useRef } from 'react';
import axios from 'axios';
import * as pdfjsLib from 'pdfjs-dist/webpack';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import './FileUpload.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.js`;

const FileUpload = () => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [mergedPdfUrl, setMergedPdfUrl] = useState(null); // State to store merged PDF URL
  const [isDownloading, setIsDownloading] = useState(false); // State to manage blinking and disabling
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);
  const downloadButtonRef = useRef(null);

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);
    processFiles(files);
    fileInputRef.current.value = null; // Clear file input to allow re-uploading
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const files = Array.from(event.dataTransfer.files);
    processFiles(files);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const processFiles = (files) => {
    const filePreviews = files.map((file) => {
      const fileReader = new FileReader();

      return new Promise((resolve) => {
        fileReader.onload = async (e) => {
          const arrayBuffer = e.target.result;
          const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          const page = await pdfDoc.getPage(1); // Get the first page

          const viewport = page.getViewport({ scale: 2 }); // Increase scale for larger preview
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({ canvasContext: context, viewport: viewport }).promise;
          const imgURL = canvas.toDataURL();
          resolve({ file, imgURL });
        };

        fileReader.readAsArrayBuffer(file);
      });
    });

    Promise.all(filePreviews).then((newPreviews) => {
      setPreviews((prevPreviews) => [...prevPreviews, ...newPreviews]);
      setSelectedFiles((prevFiles) => [...prevFiles, ...files]);
    });
  };

  const handleRemoveFile = (index) => {
    const updatedPreviews = previews.filter((_, i) => i !== index);
    const updatedFiles = selectedFiles.filter((_, i) => i !== index);

    setPreviews(updatedPreviews);
    setSelectedFiles(updatedFiles);

    // If no files are left, clear the input
    if (updatedFiles.length === 0) {
      fileInputRef.current.value = null;
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData();
    selectedFiles.forEach((file) => {
        formData.append('files', file);
    });

    try {
        const response = await axios.post('http://localhost:5001/upload', formData, {
            responseType: 'blob',
        });

        const url = window.URL.createObjectURL(new Blob([response.data]));
        setMergedPdfUrl(url); // Store the URL of the merged PDF

        // Start blinking effect
        setIsDownloading(true);

        // Stop blinking effect after 2 seconds
        setTimeout(() => {
            setIsDownloading(false);
        }, 2000);
    } catch (error) {
        console.error('Error uploading files:', error);
    }
};

const handleDownload = () => {
    const link = document.createElement('a');
    link.href = mergedPdfUrl;
    link.setAttribute('download', 'merged.pdf');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};


  const handleDragEnd = (result) => {
    if (!result.destination) {
      return;
    }
    const reorderedPreviews = Array.from(previews);
    const [moved] = reorderedPreviews.splice(result.source.index, 1);
    reorderedPreviews.splice(result.destination.index, 0, moved);
    setPreviews(reorderedPreviews);
    setSelectedFiles(reorderedPreviews.map(preview => preview.file));
  };

  const handleReset = () => {
    setPreviews([]);
    setSelectedFiles([]);
    setMergedPdfUrl(null); // Clear the merged PDF URL
    setIsDownloading(false); // Stop blinking effect
    fileInputRef.current.value = null; // Reset file input
  };

  return (
    <div className="centered-container">
      <h1>PDF Merger</h1>
      <div
        className="drag-drop-area"
        ref={dropZoneRef}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current.click()}
      >
        <span className="upload-icon">+</span>
        <input
          type="file"
          id="file-upload"
          multiple
          onChange={handleFileChange}
          ref={fileInputRef}
          style={{ display: 'none' }}
        />
      </div>
      <div className="button-container">
        <button onClick={handleReset} className="reset-button">Reset</button>
        <button
          onClick={handleSubmit}
          className="submit-button"
          disabled={selectedFiles.length === 0}
        >
          Merge PDFs
        </button>
        <button
    ref={downloadButtonRef}
    className={`download-button ${isDownloading ? 'blink' : ''}`}
    onClick={handleDownload}
    disabled={!mergedPdfUrl}
>
    Download Merged
</button>

      </div>
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="droppable" direction="horizontal">
          {(provided) => (
            <div
              className="preview-container"
              ref={provided.innerRef}
              {...provided.droppableProps}
            >
              {previews.map((preview, index) => (
  <Draggable key={`${preview.file.name}-${index}`} draggableId={`${preview.file.name}-${index}`} index={index}>
    {(provided) => (
      <div
        ref={provided.innerRef}
        {...provided.draggableProps}
        {...provided.dragHandleProps}
        className="preview-wrapper"
      >
        <img src={preview.imgURL} alt={`Preview ${index + 1}`} className="preview-image" />
        <div
          className="file-name"
          data-fullname={preview.file.name}
        >
          {preview.file.name.length > 15 ? `${preview.file.name.slice(0, 15)}...` : preview.file.name}
        </div>
        <button className="remove-button" onClick={() => handleRemoveFile(index)}>
          &times;
        </button>
      </div>
    )}
  </Draggable>
))}

              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
};

export default FileUpload;
