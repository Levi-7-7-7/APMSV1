import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import adminAxios from "../api/adminAxios";
import * as XLSX from "xlsx";
import {
  UserPlus, FilePlus, Download, Edit2, Trash2, Plus,
  LogOut, Link2, Users, Layers, GitBranch, Tag, Shield, Search, ArrowRightLeft
} from "lucide-react";
import "../css/AdminPanel.css";

export default function AdminPanel() {
  const navigate = useNavigate();
  const handleLogout = () => { localStorage.removeItem("adminToken"); navigate("/"); };

  const [tab, setTab]     = useState("tutors");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]     = useState("");
  const [msgType, setMsgType] = useState("success");

  const flash = (text, type = "success") => {
    setMsg(text); setMsgType(type);
    setTimeout(() => setMsg(""), 4000);
  };

  const [tutors, setTutors]         = useState([]);
  const [batches, setBatches]       = useState([]);
  const [branches, setBranches]     = useState([]);
  const [categories, setCategories] = useState([]);
  const [students, setStudents]     = useState([]);

  const [studentForm, setStudentForm] = useState({ name: "", registerNumber: "", email: "", isLateralEntry: false, batchId: "", branchId: "" });
  const [studentSearch, setStudentSearch] = useState("");
  const [studentBatchFilter, setStudentBatchFilter]   = useState("");
  const [studentBranchFilter, setStudentBranchFilter] = useState("");
  const [createdStudentPassword, setCreatedStudentPassword] = useState("");

  // Move-student panel: which student is currently being reassigned
  const [movingStudentId, setMovingStudentId] = useState(null);
  const [moveBatchId, setMoveBatchId]   = useState("");
  const [moveBranchId, setMoveBranchId] = useState("");

  // Batch delete (students who have passed out, or any batch being cleared out)
  const [batchDeleteBatchId, setBatchDeleteBatchId] = useState("");
  const [batchDeleteBranchId, setBatchDeleteBranchId] = useState("");
  const [batchDeletePreviewCount, setBatchDeletePreviewCount] = useState(null);
  const [batchDeleting, setBatchDeleting] = useState(false);

  const [tutorForm, setTutorForm]   = useState({ name: "", email: "", password: "" });
  const tutorCsvRef = useRef(null);

  const [assignTutorId,  setAssignTutorId]  = useState("");
  const [assignBatchId,  setAssignBatchId]  = useState("");
  const [assignBranchId, setAssignBranchId] = useState("");
  const [assignRole,     setAssignRole]     = useState("");

  const [batchName,  setBatchName]  = useState("");
  const [branchName, setBranchName] = useState("");

  const [categoryForm, setCategoryForm] = useState({ name: "", description: "", maxPoints: "", minDuration: "" });
  const [editingCat, setEditingCat] = useState(null);
  const [newSub, setNewSub]         = useState({ name: "", points: "" });

  // Which category currently has its "add subcategory" inline form open
  const [addingSubCatId, setAddingSubCatId] = useState(null);

  // Subcategory editing state
  const [editingSub, setEditingSub]   = useState(null); // { catId, sub }
  const [editSubForm, setEditSubForm] = useState({ name: "", points: "" });

  // Level management state
  const [managingLevelsCat, setManagingLevelsCat] = useState(null); // catId
  const [managingLevelsSub, setManagingLevelsSub] = useState(null); // subId
  const [newLevel, setNewLevel] = useState({ name: "", prizes: [
    { type: "Participation", points: "" },
    { type: "First", points: "" },
    { type: "Second", points: "" },
    { type: "Third", points: "" },
  ]});

  // Level editing state — lets the admin fix an existing level's name/points
  // instead of having to delete and recreate it from scratch
  const [editingLevelName, setEditingLevelName] = useState(null); // original name of the level being edited
  const [editLevelForm, setEditLevelForm] = useState({ name: "", prizes: [] });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [tR, baR, brR, cR, sR] = await Promise.all([
        adminAxios.get("/admin/tutors"),
        adminAxios.get("/admin/batches"),
        adminAxios.get("/admin/branches"),
        adminAxios.get("/admin/categories"),
        adminAxios.get("/admin/students"),
      ]);
      setTutors(tR.data.tutors || []);
      setBatches(baR.data.batches || []);
      setBranches(brR.data.branches || []);
      setCategories(cR.data.categories || []);
      setStudents(sR.data.students || []);
    } catch { flash("Failed to fetch data", "error"); }
    finally { setLoading(false); }
  };

  // ── TUTORS ──
  const handleTutorCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await adminAxios.post("/admin/tutors", tutorForm);
      setTutors(p => [res.data.tutor, ...p]);
      setTutorForm({ name: "", email: "", password: "" });
      flash("Tutor created successfully");
    } catch (err) { flash(err.response?.data?.error || "Failed to create tutor", "error"); }
  };

  const handleCsvUpload = async (e) => {
    e.preventDefault();
    const file = tutorCsvRef.current?.files?.[0];
    if (!file) return flash("Select a CSV file first", "error");
    const fd = new FormData(); fd.append("file", file);
    try {
      const res = await adminAxios.post("/admin/tutors/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      flash(res.data.message || "CSV uploaded"); fetchAll();
    } catch (err) { flash(err.response?.data?.error || "CSV upload failed", "error"); }
  };

  const handleDeleteTutor = async (id) => {
    if (!window.confirm("Delete this tutor?")) return;
    try {
      await adminAxios.delete(`/admin/tutors/${id}`);
      setTutors(p => p.filter(t => t._id !== id)); flash("Tutor deleted");
    } catch { flash("Failed to delete tutor", "error"); }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!assignTutorId) return flash("Select a tutor", "error");
    const payload = {};
    if (assignBatchId)  payload.batchId  = assignBatchId;
    if (assignBranchId) payload.branchId = assignBranchId;
    if (assignRole)      payload.role     = assignRole;
    if (!payload.batchId && !payload.branchId && !payload.role) return flash("Select a batch, branch, or role", "error");
    try {
      await adminAxios.patch(`/admin/tutors/${assignTutorId}/assign`, payload);
      flash("Tutor updated");
      setAssignTutorId(""); setAssignBatchId(""); setAssignBranchId(""); setAssignRole("");
      fetchAll();
    } catch (err) { flash(err.response?.data?.error || "Failed to assign", "error"); }
  };

  // ── STUDENTS ──
  const fetchStudents = async (overrides = {}) => {
    const search = overrides.search ?? studentSearch;
    const batch  = overrides.batch  ?? studentBatchFilter;
    const branch = overrides.branch ?? studentBranchFilter;
    try {
      const params = {};
      if (search) params.search = search;
      if (batch)  params.batch  = batch;
      if (branch) params.branch = branch;
      const res = await adminAxios.get("/admin/students", { params });
      setStudents(res.data.students || []);
    } catch { flash("Failed to fetch students", "error"); }
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    setCreatedStudentPassword("");
    try {
      const res = await adminAxios.post("/admin/students", studentForm);
      flash(res.data.message || "Student added");
      setCreatedStudentPassword(res.data.defaultPassword || "");
      setStudentForm({ name: "", registerNumber: "", email: "", isLateralEntry: false, batchId: "", branchId: "" });
      fetchStudents();
    } catch (err) { flash(err.response?.data?.error || "Failed to add student", "error"); }
  };

  const handleDeleteStudent = async (id) => {
    if (!window.confirm("Delete this student? This also removes their uploaded certificates and profile photo permanently.")) return;
    try {
      await adminAxios.delete(`/admin/students/${id}`);
      setStudents(p => p.filter(s => s._id !== id));
      flash("Student deleted");
    } catch (err) { flash(err.response?.data?.error || "Failed to delete student", "error"); }
  };

  // A batch name is expected to look like "2022-2026" — treat it as passed
  // out once its end year is this year or earlier.
  const isBatchPassedOut = (batchName) => {
    const match = /(\d{4})\s*-\s*(\d{4})/.exec(batchName || "");
    if (!match) return false;
    return parseInt(match[2], 10) <= new Date().getFullYear();
  };

  // Recompute how many students match the chosen batch/branch, so the admin
  // sees a count before committing to the delete.
  useEffect(() => {
    if (!batchDeleteBatchId) { setBatchDeletePreviewCount(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const params = { batch: batchDeleteBatchId };
        if (batchDeleteBranchId) params.branch = batchDeleteBranchId;
        const res = await adminAxios.get("/admin/students", { params });
        if (!cancelled) setBatchDeletePreviewCount((res.data.students || []).length);
      } catch {
        if (!cancelled) setBatchDeletePreviewCount(null);
      }
    })();
    return () => { cancelled = true; };
  }, [batchDeleteBatchId, batchDeleteBranchId]);

  const handleBatchDeleteStudents = async () => {
    if (!batchDeleteBatchId) return flash("Select a batch first", "error");
    const batchName  = batches.find(b => b._id === batchDeleteBatchId)?.name || "this batch";
    const branchName = branches.find(br => br._id === batchDeleteBranchId)?.name;
    const scopeLabel = branchName ? `${batchName} — ${branchName}` : `${batchName} (all branches)`;

    if (!window.confirm(
      `Delete ALL ${batchDeletePreviewCount ?? ""} student(s) in ${scopeLabel}? ` +
      `This permanently removes their accounts, certificates, profile photos, and the batch's ` +
      `certificate folder(s) from the file server. This cannot be undone.`
    )) return;

    setBatchDeleting(true);
    try {
      const params = {};
      if (batchDeleteBranchId) params.branch = batchDeleteBranchId;
      const res = await adminAxios.delete(`/admin/batches/${batchDeleteBatchId}/students`, { params });
      flash(res.data.message || "Batch students deleted");
      setBatchDeleteBatchId(""); setBatchDeleteBranchId(""); setBatchDeletePreviewCount(null);
      fetchStudents();
    } catch (err) {
      flash(err.response?.data?.error || "Batch delete failed", "error");
    } finally {
      setBatchDeleting(false);
    }
  };

  const startMoveStudent = (student) => {
    setMovingStudentId(student._id);
    setMoveBatchId(student.batch?._id || "");
    setMoveBranchId(student.branch?._id || "");
  };

  const handleMoveStudent = async (e) => {
    e.preventDefault();
    const payload = {};
    if (moveBatchId)  payload.batchId  = moveBatchId;
    if (moveBranchId) payload.branchId = moveBranchId;
    if (!payload.batchId && !payload.branchId) return flash("Select a batch and/or branch", "error");
    try {
      const res = await adminAxios.patch(`/admin/students/${movingStudentId}`, payload);
      setStudents(p => p.map(s => s._id === movingStudentId ? res.data.student : s));
      flash("Student moved successfully");
      setMovingStudentId(null); setMoveBatchId(""); setMoveBranchId("");
    } catch (err) { flash(err.response?.data?.error || "Failed to move student", "error"); }
  };

  // ── BATCHES ──
  const handleAddBatch = async (e) => {
    e.preventDefault();
    try {
      const res = await adminAxios.post("/admin/batches", { name: batchName.trim() });
      setBatches(p => [res.data.batch, ...p]); setBatchName(""); flash("Batch added");
    } catch (err) { flash(err.response?.data?.error || "Failed to add batch", "error"); }
  };

  const handleDeleteBatch = async (id) => {
    if (!window.confirm("Delete this batch?")) return;
    try {
      await adminAxios.delete(`/admin/batches/${id}`);
      setBatches(p => p.filter(b => b._id !== id)); flash("Batch deleted");
    } catch { flash("Failed to delete batch", "error"); }
  };

  // ── BRANCHES ──
  const handleAddBranch = async (e) => {
    e.preventDefault();
    try {
      const res = await adminAxios.post("/admin/branches", { name: branchName.trim() });
      setBranches(p => [res.data.branch, ...p]); setBranchName(""); flash("Branch added");
    } catch (err) { flash(err.response?.data?.error || "Failed to add branch", "error"); }
  };

  const handleDeleteBranch = async (id) => {
    if (!window.confirm("Delete this branch?")) return;
    try {
      await adminAxios.delete(`/admin/branches/${id}`);
      setBranches(p => p.filter(b => b._id !== id)); flash("Branch deleted");
    } catch { flash("Failed to delete branch", "error"); }
  };

  // ── CATEGORIES ──
  const handleSaveCategory = async (e) => {
    e.preventDefault();
    const payload = { ...categoryForm, maxPoints: categoryForm.maxPoints ? Number(categoryForm.maxPoints) : undefined };
    try {
      if (editingCat) {
        const res = await adminAxios.put(`/admin/categories/${editingCat._id}`, payload);
        setCategories(p => p.map(c => c._id === res.data.category._id ? res.data.category : c));
        setEditingCat(null); flash("Category updated");
      } else {
        const res = await adminAxios.post("/admin/categories", payload);
        setCategories(p => [res.data.category, ...p]); flash("Category created");
      }
      setCategoryForm({ name: "", description: "", maxPoints: "", minDuration: "" });
    } catch (err) { flash(err.response?.data?.error || "Failed to save category", "error"); }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm("Delete this category?")) return;
    try {
      await adminAxios.delete(`/admin/categories/${id}`);
      setCategories(p => p.filter(c => c._id !== id)); flash("Category deleted");
    } catch { flash("Failed to delete", "error"); }
  };

  const handleAddSub = async (catId) => {
    if (!newSub.name || !newSub.points) return flash("Subcategory name + points required", "error");
    try {
      const res = await adminAxios.post(`/admin/categories/${catId}/subcategory`, { name: newSub.name, points: Number(newSub.points) });
      setCategories(p => p.map(c => c._id === catId ? res.data.category : c));
      setNewSub({ name: "", points: "" });
      setAddingSubCatId(null);
      flash("Subcategory added");
    } catch (err) { flash(err.response?.data?.error || "Failed", "error"); }
  };

  const handleOpenAddSub = (catId) => {
    setNewSub({ name: "", points: "" });
    setAddingSubCatId(prev => (prev === catId ? null : catId));
  };

  const handleDeleteSub = async (catId, subId) => {
    if (!window.confirm("Remove this subcategory?")) return;
    try {
      await adminAxios.delete(`/admin/categories/${catId}/subcategory/${subId}`);
      setCategories(p => p.map(c => c._id !== catId ? c : { ...c, subcategories: c.subcategories.filter(s => s._id !== subId) }));
      flash("Subcategory removed");
    } catch { flash("Failed to remove subcategory", "error"); }
  };

  const handleEditSubOpen = (cat, sub) => {
    setEditingSub({ catId: cat._id, subId: sub._id });
    setEditSubForm({ name: sub.name, points: sub.fixedPoints != null ? String(sub.fixedPoints) : "" });
  };

  const handleEditSubSave = async () => {
    if (!editingSub) return;
    const { catId, subId } = editingSub;
    try {
      const payload = { name: editSubForm.name, points: editSubForm.points !== "" ? Number(editSubForm.points) : null };
      const res = await adminAxios.put(`/admin/categories/${catId}/subcategory/${subId}`, payload);
      setCategories(p => p.map(c => c._id === catId ? res.data.category : c));
      setEditingSub(null);
      flash("Subcategory updated");
    } catch (err) { flash(err.response?.data?.error || "Failed to update subcategory", "error"); }
  };

  const handleAddLevel = async () => {
    if (!managingLevelsCat || !managingLevelsSub) return;
    if (!newLevel.name.trim()) return flash("Level name required", "error");
    const prizes = newLevel.prizes.filter(p => p.points !== "").map(p => ({ type: p.type, points: Number(p.points) }));
    try {
      const res = await adminAxios.post(`/admin/categories/${managingLevelsCat}/subcategory/${managingLevelsSub}/level`, { name: newLevel.name, prizes });
      setCategories(p => p.map(c => c._id === managingLevelsCat ? res.data.category : c));
      setNewLevel({ name: "", prizes: [{ type: "Participation", points: "" }, { type: "First", points: "" }, { type: "Second", points: "" }, { type: "Third", points: "" }] });
      flash("Level added");
    } catch (err) { flash(err.response?.data?.error || "Failed to add level", "error"); }
  };

  const handleDeleteLevel = async (catId, subId, levelName) => {
    if (!window.confirm(`Remove level "${levelName}"?`)) return;
    try {
      const res = await adminAxios.delete(`/admin/categories/${catId}/subcategory/${subId}/level/${encodeURIComponent(levelName)}`);
      setCategories(p => p.map(c => c._id === catId ? res.data.category : c));
      flash("Level removed");
    } catch (err) { flash(err.response?.data?.error || "Failed to remove level", "error"); }
  };

  const handleEditLevelOpen = (level) => {
    setEditingLevelName(level.name);
    // Always show all 4 prize slots so the admin can add a missing one
    // (e.g. a level that only has "Participation" can have First/Second/Third added here too)
    const allTypes = ["Participation", "First", "Second", "Third"];
    setEditLevelForm({
      name: level.name,
      prizes: allTypes.map(type => {
        const existing = level.prizes.find(p => p.type === type);
        return { type, points: existing ? String(existing.points) : "" };
      }),
    });
  };

  const handleEditLevelSave = async (catId, subId) => {
    if (!editingLevelName) return;
    if (!editLevelForm.name.trim()) return flash("Level name required", "error");
    const prizes = editLevelForm.prizes.filter(p => p.points !== "").map(p => ({ type: p.type, points: Number(p.points) }));
    if (!prizes.length) return flash("At least one prize with points is required", "error");
    try {
      const res = await adminAxios.put(
        `/admin/categories/${catId}/subcategory/${subId}/level/${encodeURIComponent(editingLevelName)}`,
        { name: editLevelForm.name.trim(), prizes }
      );
      setCategories(p => p.map(c => c._id === catId ? res.data.category : c));
      setEditingLevelName(null);
      flash("Level updated");
    } catch (err) { flash(err.response?.data?.error || "Failed to update level", "error"); }
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(tutors.map(t => ({ Name: t.name, Email: t.email, Batch: t.batch?.name || "", Branch: t.branch?.name || "" })));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Tutors");
    XLSX.writeFile(wb, "tutors.xlsx");
  };

  const tabs = [
    { id: "students",   label: "Students",   icon: <UserPlus size={15}/> },
    { id: "tutors",     label: "Tutors",     icon: <Users size={15}/> },
    { id: "batches",    label: "Batches",    icon: <Layers size={15}/> },
    { id: "branches",   label: "Branches",   icon: <GitBranch size={15}/> },
    { id: "categories", label: "Categories", icon: <Tag size={15}/> },
  ];

  return (
    <div className="admin-panel">

      {/* ── Top Bar ── */}
      <div className="ap-topbar">
        <div className="ap-brand">
          <div className="ap-brand-icon"><Shield size={18}/></div>
          <div className="ap-brand-text">
            <h1>Admin Panel</h1>
            <p>Activity Points Management System</p>
          </div>
        </div>
        <div className="ap-topbar-actions">
          <button className="ap-btn" onClick={exportExcel}><Download size={15}/> Export Tutors</button>
          <button className="ap-btn logout" onClick={handleLogout}><LogOut size={15}/> Logout</button>
        </div>
      </div>

      {/* ── Tab Nav ── */}
      <nav className="ap-nav">
        {tabs.map(t => (
          <button key={t.id} className={`ap-tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
            {t.icon} {t.label}
          </button>
        ))}
      </nav>

      <div className="ap-content">

        {/* ── Stats Row ── */}
        <div className="ap-stats-row">
          {[
            { label: "Students",   val: students.length,   icon: <UserPlus size={20}/>,   cls: "blue"   },
            { label: "Tutors",     val: tutors.length,     icon: <Users size={20}/>,      cls: "blue"   },
            { label: "Batches",    val: batches.length,    icon: <Layers size={20}/>,     cls: "green"  },
            { label: "Branches",   val: branches.length,   icon: <GitBranch size={20}/>,  cls: "orange" },
            { label: "Categories", val: categories.length, icon: <Tag size={20}/>,        cls: "purple" },
          ].map(s => (
            <div key={s.label} className="ap-stat-card">
              <div className={`ap-stat-icon ${s.cls}`}>{s.icon}</div>
              <div>
                <div className="ap-stat-val">{s.val}</div>
                <div className="ap-stat-lbl">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Toast ── */}
        {msg && <div className={`ap-toast ${msgType}`}>{msg}</div>}

        {/* ══════════════ STUDENTS ══════════════ */}
        {tab === "students" && (
          <div>
            <div className="ap-grid-2">
              {/* Add student */}
              <div className="ap-card">
                <div className="ap-card-header">
                  <div className="ap-card-icon blue"><UserPlus size={16}/></div>
                  <h3>Add Student</h3>
                </div>
                <div className="ap-card-body">
                  <form onSubmit={handleAddStudent} className="ap-form">
                    <div className="ap-field"><label>Full Name</label><input placeholder="e.g. Arjun Menon" value={studentForm.name} className="ap-input" required onChange={e => setStudentForm({ ...studentForm, name: e.target.value })}/></div>
                    <div className="ap-field"><label>Register Number</label><input placeholder="e.g. 2301131001" value={studentForm.registerNumber} className="ap-input" required onChange={e => setStudentForm({ ...studentForm, registerNumber: e.target.value })}/></div>
                    <div className="ap-field"><label>Email</label><input type="email" placeholder="student@example.com" value={studentForm.email} className="ap-input" required onChange={e => setStudentForm({ ...studentForm, email: e.target.value })}/></div>
                    <div className="ap-field">
                      <label>Batch *</label>
                      <select className="ap-select" value={studentForm.batchId} required onChange={e => setStudentForm({ ...studentForm, batchId: e.target.value })}>
                        <option value="">Select batch</option>
                        {batches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                      </select>
                    </div>
                    <div className="ap-field">
                      <label>Branch *</label>
                      <select className="ap-select" value={studentForm.branchId} required onChange={e => setStudentForm({ ...studentForm, branchId: e.target.value })}>
                        <option value="">Select branch</option>
                        {branches.map(br => <option key={br._id} value={br._id}>{br.name}</option>)}
                      </select>
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", color: "var(--ap-muted)" }}>
                      <input type="checkbox" checked={studentForm.isLateralEntry} onChange={e => setStudentForm({ ...studentForm, isLateralEntry: e.target.checked })}/>
                      Lateral Entry student (40 pts required instead of 60)
                    </label>
                    <button className="btn-primary ap-btn" type="submit"><UserPlus size={15}/> Add Student</button>
                  </form>
                  {createdStudentPassword && (
                    <p style={{ marginTop: "0.75rem", fontSize: "0.85rem", color: "var(--ap-muted)" }}>
                      Default password: <strong style={{ color: "var(--ap-text)" }}>{createdStudentPassword}</strong> — share this with the student.
                    </p>
                  )}
                </div>
              </div>

              {/* Search / filter */}
              <div className="ap-card">
                <div className="ap-card-header">
                  <div className="ap-card-icon green"><Search size={16}/></div>
                  <h3>Search &amp; Filter</h3>
                </div>
                <div className="ap-card-body">
                  <div className="ap-form">
                    <div className="ap-field">
                      <label>Search (name / register number / email)</label>
                      <input
                        className="ap-input" placeholder="Start typing…" value={studentSearch}
                        onChange={e => { setStudentSearch(e.target.value); fetchStudents({ search: e.target.value }); }}
                      />
                    </div>
                    <div className="ap-field">
                      <label>Batch</label>
                      <select className="ap-select" value={studentBatchFilter} onChange={e => { setStudentBatchFilter(e.target.value); fetchStudents({ batch: e.target.value }); }}>
                        <option value="">All batches</option>
                        {batches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                      </select>
                    </div>
                    <div className="ap-field">
                      <label>Branch</label>
                      <select className="ap-select" value={studentBranchFilter} onChange={e => { setStudentBranchFilter(e.target.value); fetchStudents({ branch: e.target.value }); }}>
                        <option value="">All branches</option>
                        {branches.map(br => <option key={br._id} value={br._id}>{br.name}</option>)}
                      </select>
                    </div>
                    {(studentSearch || studentBatchFilter || studentBranchFilter) && (
                      <button
                        type="button" className="btn ap-btn"
                        onClick={() => { setStudentSearch(""); setStudentBatchFilter(""); setStudentBranchFilter(""); fetchStudents({ search: "", batch: "", branch: "" }); }}
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Batch delete — clear out an entire passed-out batch (optionally scoped to one branch) */}
            <div className="ap-card" style={{ marginTop: "1rem", borderColor: "#fecaca" }}>
              <div className="ap-card-header">
                <div className="ap-card-icon" style={{ background: "#fef2f2", color: "#dc2626" }}><Trash2 size={16}/></div>
                <h3>Batch Delete Students</h3>
              </div>
              <div className="ap-card-body">
                <p style={{ fontSize: "0.82rem", color: "var(--ap-muted)", margin: "0 0 1rem" }}>
                  Remove every student in a batch at once — meant for batches that have already passed out.
                  This deletes their accounts, certificates, profile photos, and the batch's certificate
                  folder(s) on the file server. Optionally scope it to one branch (e.g. "2022-2026 — Computer Science").
                </p>
                <div className="ap-form-row">
                  <div className="ap-field">
                    <label>Batch *</label>
                    <select className="ap-select" value={batchDeleteBatchId} onChange={e => setBatchDeleteBatchId(e.target.value)}>
                      <option value="">Select batch</option>
                      {batches.map(b => (
                        <option key={b._id} value={b._id}>
                          {b.name}{isBatchPassedOut(b.name) ? " — passed out" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="ap-field">
                    <label>Branch</label>
                    <select className="ap-select" value={batchDeleteBranchId} onChange={e => setBatchDeleteBranchId(e.target.value)}>
                      <option value="">All branches</option>
                      {branches.map(br => <option key={br._id} value={br._id}>{br.name}</option>)}
                    </select>
                  </div>
                  <button
                    type="button" className="btn ap-btn sm danger"
                    disabled={!batchDeleteBatchId || batchDeleting || batchDeletePreviewCount === 0}
                    onClick={handleBatchDeleteStudents}
                  >
                    <Trash2 size={13}/> {batchDeleting ? "Deleting…" : "Delete Batch"}
                  </button>
                </div>
                {batchDeleteBatchId && (
                  <p style={{ fontSize: "0.8rem", color: "var(--ap-muted)", marginTop: "0.5rem" }}>
                    {batchDeletePreviewCount === null ? "Checking matching students…" :
                      batchDeletePreviewCount === 0 ? "No students match this selection." :
                      `${batchDeletePreviewCount} student(s) will be permanently deleted.`}
                  </p>
                )}
              </div>
            </div>

            {/* Move student modal — overlay so it's visible regardless of scroll position */}
            {movingStudentId && (
              <div className="ap-modal-overlay" onClick={() => setMovingStudentId(null)}>
                <div className="ap-modal-panel" onClick={e => e.stopPropagation()}>
                  <h3><ArrowRightLeft size={16}/> Move {students.find(s => s._id === movingStudentId)?.name || "Student"}</h3>
                  <p style={{ fontSize: "0.82rem", color: "var(--ap-muted)", margin: "0.25rem 0 1rem" }}>
                    Choose a new batch and/or branch. Leave either as "No change" to keep it as-is.
                  </p>
                  <form onSubmit={handleMoveStudent} className="ap-form">
                    <div className="ap-field">
                      <label>Batch</label>
                      <select className="ap-select" value={moveBatchId} onChange={e => setMoveBatchId(e.target.value)}>
                        <option value="">No change</option>
                        {batches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                      </select>
                    </div>
                    <div className="ap-field">
                      <label>Branch</label>
                      <select className="ap-select" value={moveBranchId} onChange={e => setMoveBranchId(e.target.value)}>
                        <option value="">No change</option>
                        {branches.map(br => <option key={br._id} value={br._id}>{br.name}</option>)}
                      </select>
                    </div>
                    <div className="ap-modal-actions">
                      <button type="button" className="btn ap-btn" onClick={() => setMovingStudentId(null)}>Cancel</button>
                      <button className="btn-primary ap-btn" type="submit">Move Student</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Student table */}
            <div className="ap-card">
              <div className="ap-card-header">
                <div className="ap-card-icon blue"><UserPlus size={16}/></div>
                <h3>All Students <span style={{ color: "var(--ap-muted)", fontWeight: 400 }}>({students.length})</span></h3>
              </div>

              <div className="ap-table-wrap">
                {students.length === 0 ? <div className="ap-empty">No students found.</div> : (
                  <table className="ap-table">
                    <thead><tr>
                      <th>Name</th><th>Register No.</th><th>Email</th><th>Batch</th><th>Branch</th><th>Lateral Entry</th><th>Points</th><th>Actions</th>
                    </tr></thead>
                    <tbody>
                      {students.map(s => (
                        <tr key={s._id}>
                          <td style={{ fontWeight: 600 }}>{s.name}</td>
                          <td style={{ color: "var(--ap-muted)" }}>{s.registerNumber}</td>
                          <td style={{ color: "var(--ap-muted)" }}>{s.email}</td>
                          <td>{s.batch?.name  ? <span className="ap-badge assigned">{s.batch.name}</span>  : <span className="ap-badge none">—</span>}</td>
                          <td>{s.branch?.name ? <span className="ap-badge assigned">{s.branch.name}</span> : <span className="ap-badge none">—</span>}</td>
                          <td>{s.isLateralEntry ? <span className="ap-badge assigned">Yes</span> : <span className="ap-badge none">No</span>}</td>
                          <td>{s.totalPoints ?? 0}</td>
                          <td>
                            <div className="ap-table-actions">
                              <button onClick={() => startMoveStudent(s)} className="btn ap-btn sm"><ArrowRightLeft size={13}/> Move</button>
                              <button onClick={() => handleDeleteStudent(s._id)} className="btn ap-btn sm danger"><Trash2 size={13}/> Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════ TUTORS ══════════════ */}
        {tab === "tutors" && (
          <div>
            <div className="ap-grid-2">
              {/* Add tutor */}
              <div className="ap-card">
                <div className="ap-card-header">
                  <div className="ap-card-icon blue"><UserPlus size={16}/></div>
                  <h3>Add Tutor</h3>
                </div>
                <div className="ap-card-body">
                  <form onSubmit={handleTutorCreate} className="ap-form">
                    <div className="ap-field"><label>Full Name</label><input placeholder="e.g. Dr. Ravi Kumar" value={tutorForm.name} className="ap-input" required onChange={e => setTutorForm({ ...tutorForm, name: e.target.value })}/></div>
                    <div className="ap-field"><label>Email</label><input type="email" placeholder="tutor@college.edu" value={tutorForm.email} className="ap-input" required onChange={e => setTutorForm({ ...tutorForm, email: e.target.value })}/></div>
                    <div className="ap-field"><label>Password</label><input type="password" placeholder="Set a password" value={tutorForm.password} className="ap-input" required onChange={e => setTutorForm({ ...tutorForm, password: e.target.value })}/></div>
                    <button className="btn-primary ap-btn" type="submit"><UserPlus size={15}/> Create Tutor</button>
                  </form>
                </div>
              </div>

              {/* CSV upload */}
              <div className="ap-card">
                <div className="ap-card-header">
                  <div className="ap-card-icon green"><FilePlus size={16}/></div>
                  <h3>Bulk Upload (CSV)</h3>
                </div>
                <div className="ap-card-body">
                  <p style={{ fontSize: "0.85rem", color: "var(--ap-muted)", marginBottom: "1rem" }}>
                    CSV must have columns: <strong>name, email, password</strong>
                  </p>
                  <form onSubmit={handleCsvUpload} className="ap-form">
                    <input ref={tutorCsvRef} type="file" accept=".csv" style={{ fontSize: "0.875rem" }}/>
                    <button className="btn ap-btn" type="submit"><FilePlus size={15}/> Upload CSV</button>
                  </form>
                </div>
              </div>
            </div>

            {/* Assign batch/branch/role */}
            <div className="ap-assign-panel">
              <h3><Link2 size={16}/> Assign Batch, Branch &amp; Role to Tutor</h3>
              <form onSubmit={handleAssign} className="ap-form-row">
                <div className="ap-field">
                  <label>Tutor *</label>
                  <select className="ap-select" value={assignTutorId} onChange={e => setAssignTutorId(e.target.value)} required>
                    <option value="">Select tutor</option>
                    {tutors.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="ap-field">
                  <label>Role</label>
                  <select className="ap-select" value={assignRole} onChange={e => setAssignRole(e.target.value)}>
                    <option value="">No change</option>
                    <option value="tutor">Tutor (own batch + branch)</option>
                    <option value="hod">HOD (whole department)</option>
                    <option value="principal">Principal (everything)</option>
                  </select>
                </div>
                <div className="ap-field">
                  <label>Batch</label>
                  <select className="ap-select" value={assignBatchId} onChange={e => setAssignBatchId(e.target.value)} disabled={assignRole === "hod" || assignRole === "principal"}>
                    <option value="">No change</option>
                    {batches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                  </select>
                </div>
                <div className="ap-field">
                  <label>Branch</label>
                  <select className="ap-select" value={assignBranchId} onChange={e => setAssignBranchId(e.target.value)} disabled={assignRole === "principal"}>
                    <option value="">No change</option>
                    {branches.map(br => <option key={br._id} value={br._id}>{br.name}</option>)}
                  </select>
                </div>
                <div className="ap-field">
                  <label>&nbsp;</label>
                  <button className="btn-primary ap-btn" type="submit">Assign</button>
                </div>
              </form>
              {(assignRole === "hod" || assignRole === "principal") && (
                <p style={{ fontSize: "0.8rem", color: "var(--ap-muted)", marginTop: "0.5rem" }}>
                  {assignRole === "hod"
                    ? "HOD sees every batch within the branch you pick above — batch is cleared automatically."
                    : "Principal sees every batch and branch — both are cleared automatically."}
                </p>
              )}
            </div>

            {/* Tutor table */}
            <div className="ap-card">
              <div className="ap-card-header">
                <div className="ap-card-icon blue"><Users size={16}/></div>
                <h3>All Tutors <span style={{ color: "var(--ap-muted)", fontWeight: 400 }}>({tutors.length})</span></h3>
              </div>
              <div className="ap-table-wrap">
                {tutors.length === 0 ? <div className="ap-empty">No tutors yet. Add one above.</div> : (
                  <table className="ap-table">
                    <thead><tr>
                      <th>Name</th><th>Email</th><th>Role</th><th>Batch</th><th>Branch</th><th>Actions</th>
                    </tr></thead>
                    <tbody>
                      {tutors.map(t => (
                        <tr key={t._id}>
                          <td style={{ fontWeight: 600 }}>{t.name}</td>
                          <td style={{ color: "var(--ap-muted)" }}>{t.email}</td>
                          <td>
                            {t.role === "principal" ? <span className="ap-badge assigned" style={{ background: "#fdf2f8", color: "#be185d" }}>Principal</span>
                              : t.role === "hod" ? <span className="ap-badge assigned" style={{ background: "#fff7ed", color: "#ea580c" }}>HOD</span>
                              : <span className="ap-badge none">Tutor</span>}
                          </td>
                          <td>{t.batch?.name  ? <span className="ap-badge assigned">{t.batch.name}</span>  : <span className="ap-badge none">—</span>}</td>
                          <td>{t.branch?.name ? <span className="ap-badge assigned">{t.branch.name}</span> : <span className="ap-badge none">—</span>}</td>
                          <td>
                            <div className="ap-table-actions">
                              <button onClick={() => navigator.clipboard.writeText(t.email)} className="btn ap-btn sm">Copy Email</button>
                              <button onClick={() => handleDeleteTutor(t._id)} className="btn ap-btn sm danger"><Trash2 size={13}/> Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════ BATCHES ══════════════ */}
        {tab === "batches" && (
          <div>
            <div className="ap-card" style={{ maxWidth: 480, marginBottom: "1.5rem" }}>
              <div className="ap-card-header">
                <div className="ap-card-icon green"><Layers size={16}/></div>
                <h3>Add New Batch</h3>
              </div>
              <div className="ap-card-body">
                <form onSubmit={handleAddBatch} className="ap-form ap-inline-add-form">
                  <div className="ap-field ap-inline-add-field">
                    <label>Batch Name</label>
                    <input value={batchName} onChange={e => setBatchName(e.target.value)} className="ap-input" placeholder="e.g. 2022-2026" required/>
                  </div>
                  <button className="btn-primary ap-btn" type="submit"><Plus size={15}/> Add</button>
                </form>
              </div>
            </div>

            <div className="ap-card">
              <div className="ap-card-header">
                <div className="ap-card-icon green"><Layers size={16}/></div>
                <h3>All Batches <span style={{ color: "var(--ap-muted)", fontWeight: 400 }}>({batches.length})</span></h3>
              </div>
              <div className="ap-table-wrap">
                {batches.length === 0 ? <div className="ap-empty">No batches yet.</div> : (
                  <table className="ap-table">
                    <thead><tr><th>Batch Name</th><th>Action</th></tr></thead>
                    <tbody>
                      {batches.map(b => (
                        <tr key={b._id}>
                          <td style={{ fontWeight: 600 }}>{b.name}</td>
                          <td><button onClick={() => handleDeleteBatch(b._id)} className="btn ap-btn sm danger"><Trash2 size={13}/> Delete</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════ BRANCHES ══════════════ */}
        {tab === "branches" && (
          <div>
            <div className="ap-card" style={{ maxWidth: 480, marginBottom: "1.5rem" }}>
              <div className="ap-card-header">
                <div className="ap-card-icon orange"><GitBranch size={16}/></div>
                <h3>Add New Branch</h3>
              </div>
              <div className="ap-card-body">
                <form onSubmit={handleAddBranch} className="ap-form ap-inline-add-form">
                  <div className="ap-field ap-inline-add-field">
                    <label>Branch Name</label>
                    <input value={branchName} onChange={e => setBranchName(e.target.value)} className="ap-input" placeholder="e.g. Computer Science" required/>
                  </div>
                  <button className="btn-primary ap-btn" type="submit"><Plus size={15}/> Add</button>
                </form>
              </div>
            </div>

            <div className="ap-card">
              <div className="ap-card-header">
                <div className="ap-card-icon orange"><GitBranch size={16}/></div>
                <h3>All Branches <span style={{ color: "var(--ap-muted)", fontWeight: 400 }}>({branches.length})</span></h3>
              </div>
              <div className="ap-table-wrap">
                {branches.length === 0 ? <div className="ap-empty">No branches yet.</div> : (
                  <table className="ap-table">
                    <thead><tr><th>Branch Name</th><th>Action</th></tr></thead>
                    <tbody>
                      {branches.map(br => (
                        <tr key={br._id}>
                          <td style={{ fontWeight: 600 }}>{br.name}</td>
                          <td><button onClick={() => handleDeleteBranch(br._id)} className="btn ap-btn sm danger"><Trash2 size={13}/> Delete</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════ CATEGORIES ══════════════ */}
        {tab === "categories" && (
          <div>
            <div className="ap-grid-2" style={{ marginBottom: "1.5rem" }}>
              {/* Category form */}
              <div className="ap-card">
                <div className="ap-card-header">
                  <div className="ap-card-icon purple"><Tag size={16}/></div>
                  <h3>{editingCat ? "Edit Category" : "Add Category"}</h3>
                </div>
                <div className="ap-card-body">
                  <form onSubmit={handleSaveCategory} className="ap-form">
                    <div className="ap-field"><label>Category Name</label><input placeholder="e.g. Online Courses" value={categoryForm.name} className="ap-input" required onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })}/></div>
                    <div className="ap-field"><label>Description</label><input placeholder="Optional description" value={categoryForm.description} className="ap-input" onChange={e => setCategoryForm({ ...categoryForm, description: e.target.value })}/></div>
                    <div className="ap-field"><label>Max Points Cap</label><input placeholder="Default: 40" type="number" value={categoryForm.maxPoints} className="ap-input" onChange={e => setCategoryForm({ ...categoryForm, maxPoints: e.target.value })}/></div>
                    <div className="ap-field"><label>Min Duration (optional)</label><input placeholder="e.g. 30 hours" value={categoryForm.minDuration} className="ap-input" onChange={e => setCategoryForm({ ...categoryForm, minDuration: e.target.value })}/></div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button className="btn-primary ap-btn" type="submit">{editingCat ? "Save Changes" : "Create Category"}</button>
                      {editingCat && <button type="button" className="btn ap-btn" onClick={() => { setEditingCat(null); setCategoryForm({ name: "", description: "", maxPoints: "", minDuration: "" }); }}>Cancel</button>}
                    </div>
                  </form>
                </div>
              </div>

              {/* Subcategory hint */}
              <div className="ap-card">
                <div className="ap-card-header">
                  <div className="ap-card-icon purple"><Plus size={16}/></div>
                  <h3>Add Subcategory</h3>
                </div>
                <div className="ap-card-body">
                  <p style={{ fontSize: "0.85rem", color: "var(--ap-muted)" }}>
                    To add a subcategory, click <strong>"+ Sub"</strong> on the category you want it added to, below.
                    A small form will open right there for the name and points.
                  </p>
                </div>
              </div>
            </div>

            {/* Category list */}
            <p className="ap-section-title"><Tag size={14}/> All Categories ({categories.length})</p>
            <div className="ap-cat-list">
              {categories.length === 0 ? <div className="ap-empty">No categories yet.</div> : categories.map(cat => (
                <div key={cat._id} className="ap-cat-card">
                  <div className="ap-cat-card-header">
                    <div>
                      <div className="ap-cat-name">{cat.name}</div>
                      <div className="ap-cat-meta">
                        {cat.description && <span>{cat.description} · </span>}
                        Max {cat.maxPoints || 40} pts · {cat.subcategories?.length || 0} subcategories
                      </div>
                    </div>
                    <div className="ap-cat-actions">
                      <button className="btn ap-btn sm" onClick={() => { setEditingCat(cat); setCategoryForm({ name: cat.name, description: cat.description || "", maxPoints: cat.maxPoints || "", minDuration: cat.minDuration || "" }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                        <Edit2 size={13}/> Edit
                      </button>
                      <button className="btn ap-btn sm" onClick={() => handleOpenAddSub(cat._id)}>
                        <Plus size={13}/> Sub
                      </button>
                      <button className="btn ap-btn sm danger" onClick={() => handleDeleteCategory(cat._id)}>
                        <Trash2 size={13}/> Delete
                      </button>
                    </div>
                  </div>

                  {addingSubCatId === cat._id && (
                    <div className="ap-add-level-form" style={{ margin: "0 1.25rem 0.75rem" }}>
                      <strong style={{ fontSize: "0.82rem" }}>Add Subcategory to "{cat.name}"</strong>
                      <div className="ap-sub-edit-row" style={{ marginTop: "0.5rem" }}>
                        <input
                          className="ap-input ap-sub-edit-input"
                          placeholder="e.g. NPTEL Course"
                          value={newSub.name}
                          onChange={e => setNewSub({ ...newSub, name: e.target.value })}
                          autoFocus
                        />
                        <input
                          className="ap-input ap-sub-edit-input"
                          type="number"
                          placeholder="Points e.g. 10"
                          value={newSub.points}
                          onChange={e => setNewSub({ ...newSub, points: e.target.value })}
                        />
                        <button className="btn-primary ap-btn sm" onClick={() => handleAddSub(cat._id)}><Plus size={12}/> Add</button>
                        <button className="btn ap-btn sm" onClick={() => { setAddingSubCatId(null); setNewSub({ name: "", points: "" }); }}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {cat.subcategories?.length > 0 && (
                    <div className="ap-sub-list">
                      {cat.subcategories.map(s => (
                        <div key={s._id} className="ap-sub-item">
                          {editingSub?.catId === cat._id && editingSub?.subId === s._id ? (
                            <div className="ap-sub-edit-row">
                              <input className="ap-input ap-sub-edit-input" value={editSubForm.name} onChange={e => setEditSubForm({ ...editSubForm, name: e.target.value })} placeholder="Name"/>
                              <input className="ap-input ap-sub-edit-input" type="number" value={editSubForm.points} onChange={e => setEditSubForm({ ...editSubForm, points: e.target.value })} placeholder="Points (blank=level-based)"/>
                              <button className="btn ap-btn sm" onClick={handleEditSubSave}><Edit2 size={12}/> Save</button>
                              <button className="btn ap-btn sm" onClick={() => setEditingSub(null)}>Cancel</button>
                            </div>
                          ) : (
                            <div>
                              <span className="ap-sub-name">{s.name}</span>
                              <span className="ap-sub-pts">{s.fixedPoints != null ? `${s.fixedPoints} pts` : "level-based"}</span>
                              {s.maxPoints && <span className="ap-sub-pts" style={{ background: "#fff7ed", color: "#ea580c" }}>cap {s.maxPoints}</span>}
                              {s.levels?.length > 0 && <span className="ap-sub-pts" style={{ background: "#f0fdf4", color: "#16a34a" }}>{s.levels.length} level{s.levels.length > 1 ? "s" : ""}</span>}
                            </div>
                          )}
                          <div style={{ display: "flex", gap: "0.3rem", flexShrink: 0 }}>
                            {!(editingSub?.catId === cat._id && editingSub?.subId === s._id) && (
                              <>
                                <button className="btn ap-btn sm" onClick={() => handleEditSubOpen(cat, s)} title="Edit subcategory"><Edit2 size={12}/></button>
                                <button className="btn ap-btn sm" style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}
                                  onClick={() => { setManagingLevelsCat(cat._id); setManagingLevelsSub(s._id); }}
                                  title="Manage levels"
                                >Levels</button>
                              </>
                            )}
                            <button className="btn ap-btn sm danger" onClick={() => handleDeleteSub(cat._id, s._id)}><Trash2 size={12}/></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Levels management panel */}
                  {managingLevelsCat === cat._id && (
                    (() => {
                      const subForLevels = cat.subcategories.find(s => s._id === managingLevelsSub);
                      return (
                        <div className="ap-levels-panel">
                          <div className="ap-levels-header">
                            <span>Levels for: <strong>{subForLevels?.name || "Subcategory"}</strong></span>
                            <button className="btn ap-btn sm" onClick={() => { setManagingLevelsCat(null); setManagingLevelsSub(null); }}>Close ✕</button>
                          </div>

                          {subForLevels?.levels?.length > 0 ? (
                            <div className="ap-levels-list">
                              {subForLevels.levels.map(lvl => (
                                editingLevelName === lvl.name ? (
                                  <div key={lvl.name} className="ap-add-level-form" style={{ marginBottom: "0.5rem" }}>
                                    <strong style={{ fontSize: "0.82rem" }}>Edit Level</strong>
                                    <input
                                      className="ap-input"
                                      placeholder="Level name"
                                      value={editLevelForm.name}
                                      onChange={e => setEditLevelForm({ ...editLevelForm, name: e.target.value })}
                                    />
                                    <div className="ap-prizes-grid">
                                      {editLevelForm.prizes.map((p, i) => (
                                        <div key={p.type} className="ap-prize-input">
                                          <label>{p.type}</label>
                                          <input
                                            className="ap-input"
                                            type="number"
                                            placeholder="pts"
                                            value={p.points}
                                            onChange={e => {
                                              const updated = [...editLevelForm.prizes];
                                              updated[i] = { ...updated[i], points: e.target.value };
                                              setEditLevelForm({ ...editLevelForm, prizes: updated });
                                            }}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                    <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.5rem" }}>
                                      <button className="btn-primary ap-btn sm" onClick={() => handleEditLevelSave(cat._id, managingLevelsSub)}><Edit2 size={12}/> Save</button>
                                      <button className="btn ap-btn sm" onClick={() => setEditingLevelName(null)}>Cancel</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div key={lvl.name} className="ap-level-row">
                                    <span className="ap-level-name">{lvl.name}</span>
                                    <div className="ap-level-prizes">
                                      {lvl.prizes.map(p => (
                                        <span key={p.type} className="ap-prize-badge">{p.type}: {p.points}pts</span>
                                      ))}
                                    </div>
                                    <button className="btn ap-btn sm" onClick={() => handleEditLevelOpen(lvl)} title="Edit level"><Edit2 size={11}/></button>
                                    <button className="btn ap-btn sm danger" onClick={() => handleDeleteLevel(cat._id, managingLevelsSub, lvl.name)}><Trash2 size={11}/></button>
                                  </div>
                                )
                              ))}
                            </div>
                          ) : <p className="ap-levels-empty">No levels yet.</p>}

                          <div className="ap-add-level-form">
                            <strong style={{ fontSize: "0.82rem" }}>Add Level</strong>
                            <input className="ap-input" placeholder="Level name (e.g. College Level)" value={newLevel.name} onChange={e => setNewLevel({ ...newLevel, name: e.target.value })}/>
                            <div className="ap-prizes-grid">
                              {newLevel.prizes.map((p, i) => (
                                <div key={p.type} className="ap-prize-input">
                                  <label>{p.type}</label>
                                  <input className="ap-input" type="number" placeholder="pts" value={p.points}
                                    onChange={e => {
                                      const updated = [...newLevel.prizes];
                                      updated[i] = { ...updated[i], points: e.target.value };
                                      setNewLevel({ ...newLevel, prizes: updated });
                                    }}/>
                                </div>
                              ))}
                            </div>
                            <button className="btn-primary ap-btn" style={{ marginTop: "0.5rem" }} onClick={handleAddLevel}><Plus size={13}/> Add Level</button>
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
