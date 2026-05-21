import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import axiosInstance from '../api/axiosInstance';
import { ArrowLeft, Award, CheckCircle, Paperclip, Search, X, Calendar } from 'lucide-react';
import '../css/upload.css';

const MAX_FILE_SIZE_MB = 1;

function buildSearchIndex(categories) {
  const items = [];
  categories.forEach(cat => {
    (cat.subcategories || []).forEach(sub => {
      items.push({ categoryId: cat._id, categoryName: cat.name, subcategoryName: sub.name, sub });
    });
  });
  return items;
}

export default function CertificateUploadScreen() {
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [subcategories, setSubcategories] = useState([]);
  const [subcategoryName, setSubcategoryName] = useState('');
  const [levelSelected, setLevelSelected] = useState('');
  const [prizeType, setPrizeType] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [eligiblePoints, setEligiblePoints] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [eventName, setEventName] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);

  const [isOthers, setIsOthers] = useState(false);
  const [othersDescription, setOthersDescription] = useState('');

  // Prevents categoryId useEffect from wiping subcategoryName
  // when both are set together via selectSearchResult (mirrors RN behaviour)
  const skipSubcategoryReset = useRef(false);

  useEffect(() => {
    axiosInstance
      .get('/categories')
      .then(res => setCategories(res.data.categories || []))
      .catch(() => alert('Failed to fetch categories'));
  }, []);

  useEffect(() => {
    if (!categoryId) {
      setSubcategories([]);
      setSubcategoryName('');
      setLevelSelected('');
      setPrizeType('');
      setEligiblePoints(null);
      return;
    }
    const category = categories.find(c => c._id === categoryId);
    setSubcategories(category?.subcategories || []);

    // Skip reset exactly once when search result sets both categoryId + subcategoryName
    if (skipSubcategoryReset.current) {
      skipSubcategoryReset.current = false;
    } else {
      setSubcategoryName('');
      setLevelSelected('');
      setPrizeType('');
      setEligiblePoints(null);
    }
  }, [categoryId, categories]);

  useEffect(() => {
    if (!categoryId || !subcategoryName) { setEligiblePoints(null); return; }
    const category = categories.find(c => c._id === categoryId);
    const sub = category?.subcategories?.find(s => s.name === subcategoryName);
    if (!sub) return setEligiblePoints(null);
    if (sub.fixedPoints != null) {
      setEligiblePoints(sub.fixedPoints);
    } else if (sub.levels?.length) {
      if (!levelSelected || !prizeType) return setEligiblePoints(null);
      const levelObj = sub.levels.find(l => l.name === levelSelected);
      const prizeObj = levelObj?.prizes?.find(p => p.type === prizeType);
      setEligiblePoints(prizeObj?.points ?? null);
    } else {
      setEligiblePoints(null);
    }
  }, [categoryId, subcategoryName, levelSelected, prizeType, categories]);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); setShowDropdown(false); return; }
    const idx = buildSearchIndex(categories);
    const q = searchQuery.toLowerCase();
    const results = idx.filter(
      item =>
        item.subcategoryName.toLowerCase().includes(q) ||
        item.categoryName.toLowerCase().includes(q)
    ).slice(0, 10);
    setSearchResults(results);
    setShowDropdown(true);
  }, [searchQuery, categories]);

  useEffect(() => {
    const handleClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selectSearchResult = (item) => {
    const category = categories.find(c => c._id === item.categoryId);
    // Set flag BEFORE setCategoryId so useEffect skips its reset (mirrors RN)
    skipSubcategoryReset.current = true;
    setCategoryId(item.categoryId);
    setSubcategories(category?.subcategories || []);
    setSubcategoryName(item.subcategoryName);
    setLevelSelected('');
    setPrizeType('');
    setSearchQuery('');
    setShowDropdown(false);
    setIsOthers(false);
    setOthersDescription('');
  };

  const activateOthers = () => {
    setCategoryId('');
    setSubcategoryName('');
    setSubcategories([]);
    setLevelSelected('');
    setPrizeType('');
    setEligiblePoints(null);
    setSearchQuery('');
    setShowDropdown(false);
    setIsOthers(true);
    setOthersDescription('');
  };

  const handleFileUpload = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const sizeMB = file.size / 1024 / 1024;
    if (sizeMB > MAX_FILE_SIZE_MB) {
      alert(`File must be under ${MAX_FILE_SIZE_MB} MB`);
      e.target.value = '';
      setUploadedFile(null);
      return;
    }
    const mime = (file.type || '').toLowerCase();
    const name = (file.name || '').toLowerCase();
    const isImage = mime.startsWith('image/');
    const isPdf = mime === 'application/pdf' || name.endsWith('.pdf');
    if (!isImage && !isPdf) {
      alert('Only images (JPG, PNG, etc.) and PDF files are accepted as certificates.');
      e.target.value = '';
      setUploadedFile(null);
      return;
    }
    setUploadedFile(file);
  };

  const canSubmit = isOthers
    ? (othersDescription.trim() && uploadedFile && !uploading)
    : (categoryId && subcategoryName && uploadedFile && !uploading);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setUploading(true);
    try {
      const formData = new FormData();
      if (isOthers) {
        formData.append('categoryId', 'others');
        formData.append('subcategoryName', othersDescription.trim());
        formData.append('level', '');
        formData.append('prizeType', '');
      } else {
        formData.append('categoryId', categoryId);
        formData.append('subcategoryName', subcategoryName);
        formData.append('level', levelSelected || '');
        formData.append('prizeType', prizeType || '');
      }
      if (dateFrom) formData.append('dateFrom', dateFrom);
      if (dateTo) formData.append('dateTo', dateTo);
      if (eventName.trim()) formData.append('eventName', eventName.trim());
      formData.append('file', uploadedFile);

      await axiosInstance.post('/certificates/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSubmitted(true);
      setTimeout(() => navigate('/student'), 2000);
    } catch (err) {
      alert('Upload failed. Please try again.');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  if (submitted) {
    return (
      <div className="certificate-upload-container success-screen">
        <CheckCircle size={64} color="#22c55e" />
      </div>
    );
  }

  const currentSub = !isOthers && subcategoryName
    ? subcategories.find(s => s.name === subcategoryName)
    : null;
  const hasLevels = currentSub?.levels?.length > 0;

  // Dynamic prize items from the selected level's actual prizes (mirrors RN)
  const selectedLevelObj = currentSub?.levels?.find(l => l.name === levelSelected);
  const prizeItems = selectedLevelObj
    ? selectedLevelObj.prizes.map(p => ({ label: p.type, value: p.type }))
    : [];

  return (
    <div className="certificate-upload-container">
      <header>
        <button className="back-button" onClick={() => navigate('/student')}>
          <ArrowLeft />
        </button>
        <h2 className="title">Upload Certificate</h2>
      </header>

      <main>
        {/* Certificate Search */}
        <div className="search-section" ref={searchRef}>
          <label className="upload-label">Search Certificate Type</label>
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search by name, category…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery && setShowDropdown(true)}
            />
            {searchQuery && (
              <button className="search-clear" onClick={() => { setSearchQuery(''); setShowDropdown(false); }}>
                <X size={14} />
              </button>
            )}
          </div>

          {showDropdown && (
            <div className="search-dropdown">
              {searchResults.map((item, i) => (
                <button
                  key={i}
                  className="search-result-item"
                  onClick={() => selectSearchResult(item)}
                >
                  <span className="result-sub">{item.subcategoryName}</span>
                  <span className="result-cat">{item.categoryName}</span>
                </button>
              ))}
              <button className="search-result-item others-option" onClick={activateOthers}>
                <span className="result-sub">Others</span>
                <span className="result-cat">Certificate not listed above</span>
              </button>
            </div>
          )}
        </div>

        {/* Others mode */}
        {isOthers ? (
          <div className="others-section">
            <div className="others-badge">
              <span>📎 Others</span>
              <button className="others-clear" onClick={() => { setIsOthers(false); setOthersDescription(''); }}>
                <X size={14} /> Clear
              </button>
            </div>
            <input
              type="text"
              className="upload-select"
              placeholder="Describe the certificate (e.g. Blood Donation 2024)"
              value={othersDescription}
              onChange={e => setOthersDescription(e.target.value)}
            />
          </div>
        ) : (
          <>
            {/* Category dropdown */}
            <select
              value={categoryId}
              onChange={e => {
                if (e.target.value === '__others__') { activateOthers(); }
                else { setCategoryId(e.target.value); setIsOthers(false); }
              }}
              className="upload-select"
            >
              <option value="">Select category</option>
              {categories.map(c => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
              <option value="__others__">Others</option>
            </select>

            {/* Subcategory */}
            {subcategories.length > 0 && (
              <select
                value={subcategoryName}
                onChange={e => {
                  setSubcategoryName(e.target.value);
                  setLevelSelected('');
                  setPrizeType('');
                }}
                className="upload-select"
              >
                <option value="">Select subcategory</option>
                {subcategories.map(s => (
                  <option key={s.name} value={s.name}>{s.name}</option>
                ))}
              </select>
            )}

            {/* Level */}
            {hasLevels && (
              <select
                value={levelSelected}
                onChange={e => {
                  const v = e.target.value;
                  setLevelSelected(v);
                  setPrizeType('');
                  // Auto-select prize when the level only has one option (mirrors RN)
                  const lvl = currentSub?.levels?.find(l => l.name === v);
                  if (lvl?.prizes?.length === 1) {
                    setPrizeType(lvl.prizes[0].type);
                  }
                }}
                className="upload-select"
              >
                <option value="">Select Level</option>
                {currentSub.levels.map(l => (
                  <option key={l.name} value={l.name}>{l.name}</option>
                ))}
              </select>
            )}

            {/* Prize — dynamic from selected level's actual prizes (mirrors RN) */}
            {hasLevels && levelSelected && (
              <select
                value={prizeType}
                onChange={e => setPrizeType(e.target.value)}
                className="upload-select"
              >
                <option value="">Select Prize Type</option>
                {prizeItems.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            )}

            {/* Event Name — shown once subcategory is selected */}
            {subcategoryName && (
              <input
                type="text"
                className="upload-select"
                placeholder="Event / Competition / Course name (e.g. NPTEL Python 2024, Hackathon MTI)"
                value={eventName}
                onChange={e => setEventName(e.target.value)}
                maxLength={120}
              />
            )}

            {/* Eligible Points */}
            {eligiblePoints !== null && (
              <div className="eligible-points">
                <strong><Award /> Eligible Points: {eligiblePoints}</strong>
                <p>*Final points will be approved by tutor</p>
              </div>
            )}
          </>
        )}

        {/* Date / Duration */}
        <div className="date-section">
          <label className="upload-label"><Calendar size={14} /> Certificate Date / Activity Duration</label>
          <div className="date-row">
            <div className="date-field">
              <span className="date-field-label">From / Date</span>
              <input
                type="date"
                className="upload-select date-input"
                max={new Date().toISOString().split('T')[0]}
                value={dateFrom}
                onChange={e => {
                  setDateFrom(e.target.value);
                  // Reset "to" if it's now before "from" (mirrors RN)
                  if (dateTo && e.target.value > dateTo) setDateTo('');
                }}
              />
            </div>
            <div className="date-field">
              <span className="date-field-label">To (optional)</span>
              <input
                type="date"
                className="upload-select date-input"
                value={dateTo}
                min={dateFrom || undefined}
                max={new Date().toISOString().split('T')[0]}
                onChange={e => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* File Upload */}
        <div className="upload-input-wrapper">
          <label htmlFor="file-upload" className="upload-input-btn">
            <Paperclip size={16} />
            {uploadedFile
              ? `${uploadedFile.name} (${(uploadedFile.size / 1024 / 1024).toFixed(2)} MB)`
              : `Attach Certificate — Image or PDF (Max ${MAX_FILE_SIZE_MB} MB)`}
          </label>
          <input
            id="file-upload"
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileUpload}
            className="upload-input"
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="upload-btn"
        >
          {uploading ? 'Uploading...' : 'Submit Certificate'}
        </button>
      </main>

      <BottomNav activeTab="upload" />
    </div>
  );
}
