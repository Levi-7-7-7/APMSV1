import React, { useState, useEffect } from 'react';
import axiosInstance from '../api/axiosInstance';
import { useLocation, useNavigate } from 'react-router-dom';
import '../css/OtpVerificationPage.css';

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export default function OtpVerificationPage() {
  const navigate = useNavigate();
  const query = useQuery();
  const registerNumber = query.get('registerNumber') || '';

  const [otp, setOtp]           = useState('');
  const [password, setPassword] = useState('');
  const [batchId, setBatchId]   = useState('');
  const [branchId, setBranchId] = useState('');
  const [batches, setBatches]   = useState([]);
  const [branches, setBranches] = useState([]);
  // FIX: added isLateralEntry flag — lateral entry students need only 40 pts instead of 60
  const [isLateralEntry, setIsLateralEntry] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (!registerNumber) {
      alert('No register number found. Please login again.');
      navigate('/');
      return;
    }
    axiosInstance.get('/students/dropdown-data')
      .then(res => {
        setBatches(res.data.batches || []);
        setBranches(res.data.branches || []);
      })
      .catch(() => setError('Failed to load batch and branch data'));
  }, [registerNumber, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!otp || !password || !batchId || !branchId) {
      setError('All fields are required');
      return;
    }
    setLoading(true);
    try {
      const res = await axiosInstance.post('/auth/verify-otp', {
        registerNumber,
        otp,
        password,
        batch: batchId,
        branch: branchId,
        isLateralEntry,   // FIX: sent to backend so Student.isLateralEntry is set correctly
      });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('role', 'student');
      navigate('/student');
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="otp-container">
      <h1>Verify OTP &amp; Setup Account</h1>
      <p className="otp-subtext">Check your registered email for the OTP code</p>
      {error && <p className="otp-error">{error}</p>}

      <form onSubmit={handleSubmit} className="otp-form">
        <input
          type="text" placeholder="Enter OTP" value={otp} maxLength={6}
          onChange={e => setOtp(e.target.value)} className="otp-input"
        />
        <input
          type="password" placeholder="Set a password for future logins"
          value={password} minLength={6}
          onChange={e => setPassword(e.target.value)} className="otp-input"
        />
        <select value={batchId} onChange={e => setBatchId(e.target.value)} className="otp-select">
          <option value="">Select Batch</option>
          {batches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
        </select>
        <select value={branchId} onChange={e => setBranchId(e.target.value)} className="otp-select">
          <option value="">Select Branch</option>
          {branches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
        </select>

        {/* FIX: lateral entry checkbox — sets 40-point requirement instead of 60 */}
        <label style={{ display:'flex', alignItems:'center', gap:'0.5rem', fontSize:'0.95rem', margin:'0.25rem 0' }}>
          <input
            type="checkbox"
            checked={isLateralEntry}
            onChange={e => setIsLateralEntry(e.target.checked)}
          />
          I am a <strong>Lateral Entry</strong> student&nbsp;
          <span style={{ color:'#6b7280', fontSize:'0.85rem' }}>(requires 40 pts instead of 60)</span>
        </label>

        <button type="submit" disabled={loading} className="otp-button">
          {loading ? 'Verifying...' : 'Verify & Complete Setup'}
        </button>
      </form>
    </div>
  );
}
