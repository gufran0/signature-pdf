import React, { useRef, useState, useEffect } from 'react';
import SignaturePad from 'signature_pad';
import { PDFDocument } from 'pdf-lib';
import { Worker, Viewer } from '@react-pdf-viewer/core';
import '@react-pdf-viewer/core/lib/styles/index.css';
import Draggable from 'react-draggable';
import { Resizable } from 're-resizable';
import 'tailwindcss/tailwind.css';

const SignatureToPDF = () => {
  const canvasRef = useRef(null);
  const signaturePadRef = useRef(null);
  const pdfViewerRef = useRef(null);
  const [selectedPDF, setSelectedPDF] = useState(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [signatureImage, setSignatureImage] = useState(null);
  const [isSignaturePlaced, setIsSignaturePlaced] = useState(false);
  const [signaturePosition, setSignaturePosition] = useState({ x: 100, y: 100 });
  const [signatureSize, setSignatureSize] = useState({ width: 150, height: 50 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      signaturePadRef.current = new SignaturePad(canvas);
    }
  }, []);

  const clearCanvas = () => {
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
    }
    setSignatureImage(null);
    setIsSignaturePlaced(false);
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      const fileReader = new FileReader();
      fileReader.onload = async () => {
        const pdfBytes = fileReader.result;
        const pdfDoc = await PDFDocument.load(pdfBytes);
        setPdfDoc(pdfDoc);
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setPdfBlobUrl(url);
        setSelectedPDF(file);
      };
      fileReader.readAsArrayBuffer(file);
    } else {
      alert('Please select a valid PDF file.');
    }
  };

  const handleCreateSignature = () => {
    if (signaturePadRef.current && !signaturePadRef.current.isEmpty()) {
      const imgData = signaturePadRef.current.toDataURL('image/png');
      setSignatureImage(imgData);
      setIsSignaturePlaced(true);
    } else {
      alert('Please draw a signature first.');
    }
  };

  const handleEmbedSignature = async () => {
    if (!pdfDoc || !signatureImage) {
      alert('Please create a signature first and upload a PDF.');
      return;
    }

    const viewerElement = pdfViewerRef.current;
    const viewerRect = viewerElement.getBoundingClientRect();
    const scaleFactorX = pdfDoc.getPage(0).getWidth() / viewerRect.width;
    const scaleFactorY = pdfDoc.getPage(0).getHeight() / viewerRect.height;

    const x = signaturePosition.x * scaleFactorX;
    const y = (viewerRect.height - signaturePosition.y - signatureSize.height) * scaleFactorY;
    const width = signatureSize.width * scaleFactorX;
    const height = signatureSize.height * scaleFactorY;

    const pngImage = await pdfDoc.embedPng(signatureImage);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];

    firstPage.drawImage(pngImage, {
      x,
      y,
      width,
      height,
    });

    const modifiedPdfBytes = await pdfDoc.save();
    const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    setPdfBlobUrl(url);
    setIsSignaturePlaced(false);
  };

  const savePDF = () => {
    if (!pdfDoc) {
      alert('Please upload a PDF first.');
      return;
    }

    pdfDoc.save().then((modifiedPdfBytes) => {
      const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'signed_document.pdf';
      link.click();
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-100 to-blue-300 p-4 md:p-6">
      <header className="bg-blue-600 text-white py-4 shadow-md">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-3xl md:text-4xl font-bold text-center">Signature to PDF</h1>
        </div>
      </header>

      <main className="flex-grow max-w-6xl mx-auto bg-white p-4 md:p-6 mt-4 md:mt-6 rounded-lg shadow-md">
        <div className="text-center mb-4 md:mb-6">
          <h2 className="text-xl md:text-2xl font-semibold text-gray-800 mb-2 md:mb-4">Upload PDF and Add Signature</h2>
          <input 
            type="file" 
            accept="application/pdf" 
            onChange={handleFileChange} 
            className="mb-4 p-2 border rounded-md text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {pdfBlobUrl && (
          <div
            ref={pdfViewerRef}
            className="relative w-full h-[400px] md:h-[500px] overflow-auto border-2 border-gray-300 rounded-md mb-4 md:mb-6 shadow-md"
          >
            <Worker workerUrl={`https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`}>
              <Viewer fileUrl={pdfBlobUrl} />
            </Worker>
            {signatureImage && isSignaturePlaced && (
              <Draggable
                bounds="parent"
                onStop={(e, data) => {
                  const viewerElement = pdfViewerRef.current;
                  const viewerRect = viewerElement.getBoundingClientRect();
                  let newX = data.x;
                  let newY = data.y;

                  // Ensure signature stays within bounds of the PDF viewer
                  if (newX < 0) newX = 0;
                  if (newY < 0) newY = 0;
                  if (newX + signatureSize.width > viewerRect.width) newX = viewerRect.width - signatureSize.width;
                  if (newY + signatureSize.height > viewerRect.height) newY = viewerRect.height - signatureSize.height;

                  setSignaturePosition({ x: newX, y: newY });
                }}
              >
                <Resizable
                  size={signatureSize}
                  onResizeStop={(e, direction, ref, d) => {
                    const newWidth = signatureSize.width + d.width;
                    const newHeight = signatureSize.height + d.height;

                    // Ensure resized signature stays within bounds
                    const viewerElement = pdfViewerRef.current;
                    const viewerRect = viewerElement.getBoundingClientRect();
                    if (signaturePosition.x + newWidth > viewerRect.width) return;
                    if (signaturePosition.y + newHeight > viewerRect.height) return;

                    setSignatureSize({ width: newWidth, height: newHeight });
                  }}
                  style={{
                    position: 'absolute',
                    top: signaturePosition.y,
                    left: signaturePosition.x,
                    zIndex: 1000,
                    border: '2px solid #4A5568',
                    background: 'white',
                    cursor: 'move',
                    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <img
                    src={signatureImage}
                    alt="Signature"
                    style={{ width: '100%', height: '100%' }}
                  />
                </Resizable>
              </Draggable>
            )}
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={300}
          height={150}
          className="border-2 border-gray-400 rounded-md mb-4 shadow-md mx-auto w-full max-w-xs"
        />
        <div className="flex flex-wrap gap-4 justify-center">
          <button
            onClick={clearCanvas}
            className="px-4 py-2 md:px-6 md:py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition shadow-md"
          >
            Clear
          </button>
          <button
            onClick={handleCreateSignature}
            className="px-4 py-2 md:px-6 md:py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition shadow-md"
          >
            Create Signature
          </button>
          <button
            onClick={handleEmbedSignature}
            className="px-4 py-2 md:px-6 md:py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition shadow-md"
          >
            Embed Signature
          </button>
          <button
            onClick={savePDF}
            className="px-4 py-2 md:px-6 md:py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition shadow-md"
          >
            Save as PDF
          </button>
        </div>
      </main>

      <footer className="bg-blue-600 text-white py-4 mt-4 md:mt-6">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-sm md:text-lg">&copy; 2024 Signature to PDF. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default SignatureToPDF;
