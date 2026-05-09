import React, { useState } from 'react';
import tutorAxios from '../api/tutorAxios';
import { FileUp, Download, CheckCircle, AlertCircle } from 'lucide-react';
import '../css/UploadCSV.css';

// Generate and download a blank CSV template
const downloadTemplate = () => {
  const header  = 'name,registerNumber,email';
  const example = 'John Doe,2301131001,johndoe@example.com';
  const blob    = new Blob([header + '\n' + example + '\n'], { type: 'text/csv' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href        = url;
  a.download    = 'students_upload_template.csv';
  a.click();
  URL.revokeObjectURL(url);
};

const UploadCSV = () => {
  const [file, setFile]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState('');
  const [isError, setIsError] = useState(false);

  const upload = async () => {
    if (!file) return alert('Select a CSV file first!');
    setLoading(true);
    setMsg('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await tutorAxios.post('/tutors/students/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMsg(res.data.message || 'Upload successful!');
      setIsError(false);
      setFile(null);
    } catch (err) {
      setMsg(err.response?.data?.error || 'Upload failed. Check your CSV format.');
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-csv-card">
      <div className="upload-csv-header">
        <h2>Upload Students via CSV</h2>
        <p className="upload-csv-sub">Bulk-add students to the system. Students will be assigned to your batch &amp; branch automatically.</p>
      </div>

      {/* Template download */}
      <div className="csv-template-box">
        <div className="csv-template-left">
          <strong>📥 Download Template First</strong>
          <p>Use this pre-formatted CSV as your starting point. Fill in the student details and re-upload.</p>
        </div>
        <button className="csv-template-btn" onClick={downloadTemplate}>
          <Download size={16}/> Download CSV Template
        </button>
      </div>

      {/* Format guide */}
      <div className="csv-instructions">
        <h4>Required CSV Format</h4>
        <div className="csv-format-row">
          <span className="csv-col">name</span>
          <span className="csv-col">registerNumber</span>
          <span className="csv-col">email</span>
        </div>
        <div className="csv-format-row example">
          <span>John Doe</span>
          <span>2301131001</span>
          <span>john@example.com</span>
        </div>
        <ul className="csv-notes">
          <li>First row must be the header exactly as shown above</li>
          <li>Each student on a new line, no extra spaces</li>
          <li>Duplicate register numbers or emails will be skipped</li>
        </ul>
      </div>

      {/* File picker + upload */}
      <div className="upload-section">
        <label className="file-input-label">
          <FileUp size={16}/>
          <span>{file ? file.name : 'Choose CSV file…'}</span>
          <input
            type="file" accept=".csv"
            onChange={e => { setFile(e.target.files[0]); setMsg(''); }}
          />
        </label>
        <button className="upload-btn" onClick={upload} disabled={loading || !file}>
          {loading ? 'Uploading…' : 'Upload Students'}
        </button>
      </div>

      {msg && (
        <div className={`upload-result ${isError ? 'error' : 'success'}`}>
          {isError ? <AlertCircle size={16}/> : <CheckCircle size={16}/>}
          {msg}
        </div>
      )}
    </div>
  );
};

export default UploadCSV;
