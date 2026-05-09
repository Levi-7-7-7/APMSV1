import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import adminAxios from "../api/adminAxios";
import * as XLSX from "xlsx";
import {
  UserPlus, FilePlus, Download, Edit2, Trash2, Plus,
  LogOut, Link2, Users, Layers, GitBranch, Tag, Shield
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

  const [tutorForm, setTutorForm]   = useState({ name: "", email: "", password: "" });
  const tutorCsvRef = useRef(null);

  const [assignTutorId,  setAssignTutorId]  = useState("");
  const [assignBatchId,  setAssignBatchId]  = useState("");
  const [assignBranchId, setAssignBranchId] = useState("");

  const [batchName,  setBatchName]  = useState("");
  const [branchName, setBranchName] = useState("");

  const [categoryForm, setCategoryForm] = useState({ name: "", description: "", maxPoints: "", minDuration: "" });
  const [editingCat, setEditingCat] = useState(null);
  const [newSub, setNewSub]         = useState({ name: "", points: "" });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [tR, baR, brR, cR] = await Promise.all([
        adminAxios.get("/admin/tutors"),
        adminAxios.get("/admin/batches"),
        adminAxios.get("/admin/branches"),
        adminAxios.get("/admin/categories"),
      ]);
      setTutors(tR.data.tutors || []);
      setBatches(baR.data.batches || []);
      setBranches(brR.data.branches || []);
      setCategories(cR.data.categories || []);
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
    if (!payload.batchId && !payload.branchId) return flash("Select at least a batch or branch", "error");
    try {
      await adminAxios.patch(`/admin/tutors/${assignTutorId}/assign`, payload);
      flash("Batch/Branch assigned to tutor");
      setAssignTutorId(""); setAssignBatchId(""); setAssignBranchId("");
      fetchAll();
    } catch (err) { flash(err.response?.data?.error || "Failed to assign", "error"); }
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
      setNewSub({ name: "", points: "" }); flash("Subcategory added");
    } catch (err) { flash(err.response?.data?.error || "Failed", "error"); }
  };

  const handleDeleteSub = async (catId, subId) => {
    if (!window.confirm("Remove this subcategory?")) return;
    try {
      await adminAxios.delete(`/admin/categories/${catId}/subcategory/${subId}`);
      setCategories(p => p.map(c => c._id !== catId ? c : { ...c, subcategories: c.subcategories.filter(s => s._id !== subId) }));
      flash("Subcategory removed");
    } catch { flash("Failed to remove subcategory", "error"); }
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(tutors.map(t => ({ Name: t.name, Email: t.email, Batch: t.batch?.name || "", Branch: t.branch?.name || "" })));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Tutors");
    XLSX.writeFile(wb, "tutors.xlsx");
  };

  const tabs = [
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

            {/* Assign batch/branch */}
            <div className="ap-assign-panel">
              <h3><Link2 size={16}/> Assign Batch &amp; Branch to Tutor</h3>
              <form onSubmit={handleAssign} className="ap-form-row">
                <div className="ap-field">
                  <label>Tutor *</label>
                  <select className="ap-select" value={assignTutorId} onChange={e => setAssignTutorId(e.target.value)} required>
                    <option value="">Select tutor</option>
                    {tutors.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="ap-field">
                  <label>Batch</label>
                  <select className="ap-select" value={assignBatchId} onChange={e => setAssignBatchId(e.target.value)}>
                    <option value="">No change</option>
                    {batches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                  </select>
                </div>
                <div className="ap-field">
                  <label>Branch</label>
                  <select className="ap-select" value={assignBranchId} onChange={e => setAssignBranchId(e.target.value)}>
                    <option value="">No change</option>
                    {branches.map(br => <option key={br._id} value={br._id}>{br.name}</option>)}
                  </select>
                </div>
                <div className="ap-field">
                  <label>&nbsp;</label>
                  <button className="btn-primary ap-btn" type="submit">Assign</button>
                </div>
              </form>
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
                      <th>Name</th><th>Email</th><th>Batch</th><th>Branch</th><th>Actions</th>
                    </tr></thead>
                    <tbody>
                      {tutors.map(t => (
                        <tr key={t._id}>
                          <td style={{ fontWeight: 600 }}>{t.name}</td>
                          <td style={{ color: "var(--ap-muted)" }}>{t.email}</td>
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
                <form onSubmit={handleAddBatch} className="ap-form" style={{ flexDirection: "row", alignItems: "flex-end" }}>
                  <div className="ap-field" style={{ flex: 1 }}>
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
                <form onSubmit={handleAddBranch} className="ap-form" style={{ flexDirection: "row", alignItems: "flex-end" }}>
                  <div className="ap-field" style={{ flex: 1 }}>
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

              {/* Subcategory input */}
              <div className="ap-card">
                <div className="ap-card-header">
                  <div className="ap-card-icon purple"><Plus size={16}/></div>
                  <h3>Add Subcategory</h3>
                </div>
                <div className="ap-card-body">
                  <p style={{ fontSize: "0.85rem", color: "var(--ap-muted)", marginBottom: "1rem" }}>
                    Fill in the fields below, then click <strong>"+ Sub"</strong> on any category row.
                  </p>
                  <div className="ap-form">
                    <div className="ap-field"><label>Subcategory Name</label><input placeholder="e.g. NPTEL Course" className="ap-input" value={newSub.name} onChange={e => setNewSub({ ...newSub, name: e.target.value })}/></div>
                    <div className="ap-field"><label>Points</label><input placeholder="e.g. 10" type="number" className="ap-input" value={newSub.points} onChange={e => setNewSub({ ...newSub, points: e.target.value })}/></div>
                  </div>
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
                      <button className="btn ap-btn sm" onClick={() => handleAddSub(cat._id)}>
                        <Plus size={13}/> Sub
                      </button>
                      <button className="btn ap-btn sm danger" onClick={() => handleDeleteCategory(cat._id)}>
                        <Trash2 size={13}/> Delete
                      </button>
                    </div>
                  </div>

                  {cat.subcategories?.length > 0 && (
                    <div className="ap-sub-list">
                      {cat.subcategories.map(s => (
                        <div key={s._id} className="ap-sub-item">
                          <div>
                            <span className="ap-sub-name">{s.name}</span>
                            <span className="ap-sub-pts">{s.fixedPoints ?? "level-based"} pts</span>
                            {s.maxPoints && <span className="ap-sub-pts" style={{ background: "#fff7ed", color: "#ea580c" }}>cap {s.maxPoints}</span>}
                          </div>
                          <button className="btn ap-btn sm danger" onClick={() => handleDeleteSub(cat._id, s._id)}>
                            <Trash2 size={12}/>
                          </button>
                        </div>
                      ))}
                    </div>
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
