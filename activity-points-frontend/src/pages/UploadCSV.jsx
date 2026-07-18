import React, { useState } from 'react';
import tutorAxios from '../api/tutorAxios';
import { FileUp, Download, CheckCircle, AlertCircle, UserPlus, KeyRound } from 'lucide-react';
import '../css/UploadCSV.css';

// Generate and download a blank CSV template
const downloadTemplate = () => {
  const header  = 'name,registerNumber,email,dateOfBirth,isLateralEntry';
  const example = 'John Doe,2301131001,johndoe@example.com,2004-08-15,false';
  const blob    = new Blob([header + '\n' + example + '\n'], { type: 'text/csv' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href        = url;
  a.download    = 'students_upload_template.csv';
  a.click();
  URL.revokeObjectURL(url);
};

const EMPTY_FORM = { name: '', registerNumber: '', email: '', dateOfBirth: '', isLateralEntry: false };

const UploadCSV = () => {
  const [mode, setMode] = useState('csv'); // 'csv' | 'single'

  // ── Bulk CSV state ──────────────────────────────────────────────────────
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
      const note = res.data.note ? ` ${res.data.note}` : '';
      setMsg((res.data.message || 'Upload successful!') + note);
      setIsError(false);
      setFile(null);
    } catch (err) {
      setMsg(err.response?.data?.error || 'Upload failed. Check your CSV format.');
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  // ── Single-student state ────────────────────────────────────────────────
  const [form, setForm]               = useState(EMPTY_FORM);
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleMsg, setSingleMsg]     = useState('');
  const [singleError, setSingleError] = useState(false);
  const [createdPassword, setCreatedPassword] = useState('');

  const updateField = (field) => (e) => {
    const value = field === 'isLateralEntry' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
  };

  const addSingleStudent = async (e) => {
    e.preventDefault();
    setSingleMsg('');
    setCreatedPassword('');

    if (!form.name.trim() || !form.registerNumber.trim() || !form.email.trim() || !form.dateOfBirth) {
      setSingleError(true);
      setSingleMsg('Name, register number, email, and date of birth are all required.');
      return;
    }

    setSingleLoading(true);
    try {
      const res = await tutorAxios.post('/tutors/students', form);
      setSingleError(false);
      setSingleMsg(res.data.message || 'Student added successfully');
      setCreatedPassword(res.data.defaultPassword || '');
      setForm(EMPTY_FORM);
    } catch (err) {
      setSingleError(true);
      setSingleMsg(err.response?.data?.error || 'Failed to add student.');
    } finally {
      setSingleLoading(false);
    }
  };

  return (
    <div className="upload-csv-card">
      <div className="upload-csv-header">
        <h2>Add Students</h2>
        <p className="upload-csv-sub">Students will be assigned to your batch &amp; branch automatically, with a default password of <strong>firstname + birth year</strong> (e.g. <code>arjun2004</code>).</p>
      </div>

      {/* Mode toggle */}
      <div className="csv-template-box" style={{ gap: '0.5rem' }}>
        <button
          type="button"
          className="csv-template-btn"
          style={{ opacity: mode === 'csv' ? 1 : 0.6 }}
          onClick={() => setMode('csv')}
        >
          <FileUp size={16}/> Bulk Upload (CSV)
        </button>
        <button
          type="button"
          className="csv-template-btn"
          style={{ opacity: mode === 'single' ? 1 : 0.6 }}
          onClick={() => setMode('single')}
        >
          <UserPlus size={16}/> Add Single Student
        </button>
      </div>

      {mode === 'csv' ? (
        <>
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
              <span className="csv-col">dateOfBirth</span>
              <span className="csv-col">isLateralEntry</span>
            </div>
            <div className="csv-format-row example">
              <span>John Doe</span>
              <span>2301131001</span>
              <span>john@example.com</span>
              <span>2004-08-15</span>
              <span>false</span>
            </div>
            <ul className="csv-notes">
              <li>First row must be the header exactly as shown above</li>
              <li>dateOfBirth format: YYYY-MM-DD</li>
              <li>isLateralEntry: true/false (leave blank for false)</li>
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
        </>
      ) : (
        <form onSubmit={addSingleStudent} className="csv-instructions" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <input
            type="text" placeholder="Full name" value={form.name}
            onChange={updateField('name')} className="form-input"
          />
          <input
            type="text" placeholder="Register number" value={form.registerNumber}
            onChange={updateField('registerNumber')} className="form-input"
          />
          <input
            type="email" placeholder="Email" value={form.email}
            onChange={updateField('email')} className="form-input"
          />
          <label style={{ fontSize: '0.85rem', color: '#6b7280' }}>Date of birth</label>
          <input
            type="date" value={form.dateOfBirth}
            onChange={updateField('dateOfBirth')} className="form-input"
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}>
            <input
              type="checkbox" checked={form.isLateralEntry}
              onChange={updateField('isLateralEntry')}
            />
            This student is a <strong>Lateral Entry</strong> student
            <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>(requires 40 pts instead of 60)</span>
          </label>

          <button type="submit" className="upload-btn" disabled={singleLoading}>
            {singleLoading ? 'Adding…' : 'Add Student'}
          </button>

          {singleMsg && (
            <div className={`upload-result ${singleError ? 'error' : 'success'}`}>
              {singleError ? <AlertCircle size={16}/> : <CheckCircle size={16}/>}
              {singleMsg}
            </div>
          )}

          {createdPassword && (
            <div className="upload-result success" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <KeyRound size={16}/>
              Default password: <code>{createdPassword}</code> — share this with the student.
            </div>
          )}
        </form>
      )}
    </div>
  );
};

export default UploadCSV;
