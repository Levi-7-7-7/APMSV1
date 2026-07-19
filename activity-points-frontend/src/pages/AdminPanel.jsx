import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import adminAxios from "../api/adminAxios";
import * as XLSX from "xlsx";
import {
  UserPlus, FilePlus, Download, Edit2, Trash2, Plus,
  LogOut, Link2, Users, Layers, GitBranch, Tag, Shield, Search, ArrowRightLeft,
  History, Filter, ChevronLeft, ChevronRight, MoreVertical, Camera, Loader2, X
} from "lucide-react";
import PhotoCropModal from "../components/PhotoCropModal";
import "../css/AdminPanel.css";

// Small circular avatar used throughout the panel (admin/tutor/student
// tables + the top bar) — shows the photo if there is one, otherwise
// initials derived from a name or email.
function getInitials(nameOrEmail) {
  return (nameOrEmail || "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join("")
    .toUpperCase();
}

function AvatarThumb({ src, name, onClick }) {
  return (
    <button type="button" className="ap-avatar-thumb" onClick={onClick} aria-label={`View ${name || "profile"} photo`}>
      {src ? <img src={src} alt={name || "Profile"}/> : <span>{getInitials(name)}</span>}
    </button>
  );
}

export default function AdminPanel() {
  const navigate = useNavigate();
  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminEmail");
      navigate("/");
    }
  };

  // Admin identity for the top bar (email stored at login time)
  const adminEmail = localStorage.getItem("adminEmail") || "Admin";
  const adminInitials = getInitials(adminEmail);

  // Three-dot top bar menu — closes on outside click or Escape
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // ── Admin's own profile photo ──
  const [adminPhoto, setAdminPhoto] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [pendingAdminPhoto, setPendingAdminPhoto] = useState(null); // file picked, pre-crop
  const adminPhotoInputRef = useRef(null);

  useEffect(() => {
    adminAxios.get("/admin/auth/me")
      .then(res => setAdminPhoto(res.data?.admin?.profilePhoto ?? null))
      .catch(() => {});
  }, []);

  const handleAdminPhotoClick = () => { if (!photoUploading) adminPhotoInputRef.current?.click(); };

  const handleAdminPhotoFileChange = (e) => {
    const file = e.target.files?.[0];
    if (adminPhotoInputRef.current) adminPhotoInputRef.current.value = "";
    if (!file) return;
    setPhotoError("");
    setPendingAdminPhoto(file);
  };

  const confirmAdminPhotoUpload = async (croppedFile) => {
    setPhotoError("");
    setPhotoUploading(true);
    try {
      const formData = new FormData();
      formData.append("photo", croppedFile);
      const res = await adminAxios.patch("/admin/auth/profile-photo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setAdminPhoto(res.data.profilePhoto);
      setPendingAdminPhoto(null);
    } catch (err) {
      setPhotoError(err.response?.data?.error || "Could not upload photo. Please try again.");
    } finally {
      setPhotoUploading(false);
    }
  };

  // ── Shared "tap to enlarge" viewer for any profile photo in the panel
  // (admin's own, other admins, tutors, students) ──
  const [viewerPhoto, setViewerPhoto] = useState(null); // { src, initials, label }

  // Decode the logged-in admin's own id from their JWT (no library needed —
  // just reading the payload) so we can flag "You" in the admins list and
  // warn before a self-delete.
  const currentAdminId = (() => {
    try {
      const token = localStorage.getItem("adminToken");
      return JSON.parse(atob(token.split(".")[1])).id;
    } catch { return null; }
  })();

  const [tab, setTab]     = useState(null); // null = dashboard (card grid)
  const [dashboardSearch, setDashboardSearch] = useState("");
  const [sectionLoading, setSectionLoading] = useState(false);
  // Tracks which resources have already been fetched once, so re-opening a
  // section (or switching back and forth) doesn't re-fetch data that's
  // already in memory.
  const loadedRef = useRef({ tutors: false, batches: false, branches: false, categories: false, admins: false });
  const [logsEverLoaded, setLogsEverLoaded] = useState(false);
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
  const studentSearchDebounceRef = useRef(null);
  const [studentsEverLoaded, setStudentsEverLoaded] = useState(false);
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

  const [tutorForm, setTutorForm]   = useState({ name: "", email: "", password: "", role: "tutor", batchId: "", branchId: "" });
  const tutorCsvRef = useRef(null);

  const [admins, setAdmins] = useState([]);
  const [adminForm, setAdminForm] = useState({ email: "", password: "" });

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

  // ── ACTIVITY LOG ──
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logActions, setLogActions] = useState([]);
  const [logFilters, setLogFilters] = useState({ actorType: "", action: "", search: "", from: "", to: "" });
  const [logPage, setLogPage] = useState(1);
  const [logPages, setLogPages] = useState(1);
  const [logTotal, setLogTotal] = useState(0);
  const logLimit = 50;

  // ── Lazy, per-resource fetchers ──
  // Nothing is fetched on mount. Each section pulls only the data it needs,
  // the first time it's opened — the Students and Activity Log sections
  // don't auto-fetch at all, since those lists can get large; the admin
  // searches/filters for what they want instead.
  const fetchTutors = async () => {
    try { const res = await adminAxios.get("/admin/tutors"); setTutors(res.data.tutors || []); }
    catch { flash("Failed to fetch tutors", "error"); }
  };
  const fetchBatches = async () => {
    try { const res = await adminAxios.get("/admin/batches"); setBatches(res.data.batches || []); }
    catch { flash("Failed to fetch batches", "error"); }
  };
  const fetchBranches = async () => {
    try { const res = await adminAxios.get("/admin/branches"); setBranches(res.data.branches || []); }
    catch { flash("Failed to fetch branches", "error"); }
  };
  const fetchCategories = async () => {
    try { const res = await adminAxios.get("/admin/categories"); setCategories(res.data.categories || []); }
    catch { flash("Failed to fetch categories", "error"); }
  };
  const fetchAdmins = async () => {
    try { const res = await adminAxios.get("/admin/auth/admins"); setAdmins(res.data.admins || []); }
    catch { flash("Failed to fetch admins", "error"); }
  };

  // Fetch a resource only if it hasn't been fetched yet this session.
  const ensureLoaded = async (key, fetchFn) => {
    if (loadedRef.current[key]) return;
    loadedRef.current[key] = true;
    await fetchFn();
  };

  // Opens a section from the dashboard cards (or the sidebar), pulling in
  // only whatever that section actually needs.
  const openSection = async (id) => {
    setTab(id);
    setSectionLoading(true);
    try {
      if (id === "tutors") {
        await Promise.all([
          ensureLoaded("tutors", fetchTutors),
          ensureLoaded("batches", fetchBatches),
          ensureLoaded("branches", fetchBranches),
        ]);
      } else if (id === "students") {
        // Student list itself is never auto-fetched — only batch/branch
        // dropdown options, needed for the add/filter/move forms.
        await Promise.all([
          ensureLoaded("batches", fetchBatches),
          ensureLoaded("branches", fetchBranches),
        ]);
      } else if (id === "batches") {
        await ensureLoaded("batches", fetchBatches);
      } else if (id === "branches") {
        await ensureLoaded("branches", fetchBranches);
      } else if (id === "categories") {
        await ensureLoaded("categories", fetchCategories);
      } else if (id === "admins") {
        await ensureLoaded("admins", fetchAdmins);
      }
      // "logs" needs nothing preloaded — its own filter form fetches on demand.
    } finally {
      setSectionLoading(false);
    }
  };

  const goToDashboard = () => setTab(null);

  // ── ACTIVITY LOG ──
  const fetchLogs = async (overrides = {}) => {
    const page = overrides.page ?? logPage;
    setLogsLoading(true);
    try {
      const params = { page, limit: logLimit };
      if (logFilters.actorType) params.actorType = logFilters.actorType;
      if (logFilters.action)    params.action    = logFilters.action;
      if (logFilters.search)    params.search    = logFilters.search;
      if (logFilters.from)      params.from      = logFilters.from;
      if (logFilters.to)        params.to        = logFilters.to;

      const res = await adminAxios.get("/admin/logs", { params });
      setLogs(res.data.logs || []);
      setLogTotal(res.data.total || 0);
      setLogPages(res.data.pages || 1);
      setLogActions(res.data.actions || []);
      setLogPage(page);
    } catch { flash("Failed to fetch activity log", "error"); }
    finally { setLogsLoading(false); }
  };

  const applyLogFilters = (e) => {
    e.preventDefault();
    setLogsEverLoaded(true);
    fetchLogs({ page: 1 });
  };

  const clearLogFilters = () => {
    setLogFilters({ actorType: "", action: "", search: "", from: "", to: "" });
    if (logsEverLoaded) setTimeout(() => fetchLogs({ page: 1 }), 0);
  };

  const exportLogsCsv = async () => {
    try {
      const params = {};
      if (logFilters.actorType) params.actorType = logFilters.actorType;
      if (logFilters.action)    params.action    = logFilters.action;
      if (logFilters.search)    params.search    = logFilters.search;
      if (logFilters.from)      params.from      = logFilters.from;
      if (logFilters.to)        params.to        = logFilters.to;

      const res = await adminAxios.get("/admin/logs/export", { params, responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      flash("Log exported");
    } catch { flash("Failed to export activity log", "error"); }
  };

  const actorBadgeClass = (actorType) => {
    if (actorType === "admin")  return "purple";
    if (actorType === "tutor")  return "blue";
    if (actorType === "student") return "green";
    return "none";
  };

  // ── TUTORS ──
  const handleTutorCreate = async (e) => {
    e.preventDefault();
    if (tutorForm.role === "tutor" && (!tutorForm.batchId || !tutorForm.branchId)) {
      return flash("A tutor needs both a batch and a branch selected", "error");
    }
    if (tutorForm.role === "hod" && !tutorForm.branchId) {
      return flash("An HOD needs a branch selected", "error");
    }
    try {
      const res = await adminAxios.post("/admin/tutors", tutorForm);
      setTutors(p => [res.data.tutor, ...p]);
      setTutorForm({ name: "", email: "", password: "", role: "tutor", batchId: "", branchId: "" });
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
      flash(res.data.message || "CSV uploaded");
      if (res.data.skipped?.length) {
        window.alert(`Some rows were skipped:\n\n${res.data.skipped.join("\n")}`);
      }
      fetchTutors();
    } catch (err) { flash(err.response?.data?.error || "CSV upload failed", "error"); }
  };

  const handleDeleteTutor = async (id) => {
    if (!window.confirm("Delete this tutor?")) return;
    try {
      await adminAxios.delete(`/admin/tutors/${id}`);
      setTutors(p => p.filter(t => t._id !== id)); flash("Tutor deleted");
    } catch { flash("Failed to delete tutor", "error"); }
  };

  // ── ADMINS ──
  const handleAdminCreate = async (e) => {
    e.preventDefault();
    if (adminForm.password.length < 8) return flash("Password must be at least 8 characters", "error");
    try {
      const res = await adminAxios.post("/admin/auth/register", adminForm);
      setAdmins(p => [...p, { _id: res.data.id, email: adminForm.email }].sort((a, b) => a.email.localeCompare(b.email)));
      setAdminForm({ email: "", password: "" });
      flash("Admin created successfully");
    } catch (err) { flash(err.response?.data?.error || "Failed to create admin", "error"); }
  };

  const handleDeleteAdmin = async (id, email) => {
    const isSelf = id === currentAdminId;
    const warning = isSelf
      ? `This is YOUR OWN account (${email}) — deleting it will log you out immediately. Continue?`
      : `Delete admin ${email}?`;
    if (!window.confirm(warning)) return;
    try {
      await adminAxios.delete(`/admin/auth/admins/${id}`);
      setAdmins(p => p.filter(a => a._id !== id));
      flash("Admin deleted");
      if (isSelf) handleLogout();
    } catch (err) { flash(err.response?.data?.error || "Failed to delete admin", "error"); }
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
      fetchTutors();
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
      setStudentsEverLoaded(true);
    } catch { flash("Failed to fetch students", "error"); }
  };

  // Waits for a short pause in typing before actually hitting the API —
  // avoids firing a request on every keystroke while searching students.
  const fetchStudentsDebounced = (overrides = {}) => {
    if (studentSearchDebounceRef.current) clearTimeout(studentSearchDebounceRef.current);
    studentSearchDebounceRef.current = setTimeout(() => fetchStudents(overrides), 400);
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
    { id: "students",   label: "Students",     desc: "Add, search, and manage student accounts",   icon: <UserPlus size={15}/>,   bigIcon: <UserPlus size={26}/>,   cls: "blue"   },
    { id: "tutors",     label: "Tutors",       desc: "Add tutors, assign batches, upload CSV",      icon: <Users size={15}/>,      bigIcon: <Users size={26}/>,      cls: "teal"   },
    { id: "batches",    label: "Batches",      desc: "Manage academic batches",                     icon: <Layers size={15}/>,     bigIcon: <Layers size={26}/>,     cls: "green"  },
    { id: "branches",   label: "Branches",     desc: "Manage department branches",                  icon: <GitBranch size={15}/>,  bigIcon: <GitBranch size={26}/>,  cls: "orange" },
    { id: "categories", label: "Categories",   desc: "Activity point categories & levels",          icon: <Tag size={15}/>,        bigIcon: <Tag size={26}/>,        cls: "purple" },
    { id: "admins",     label: "Admins",       desc: "Manage admin accounts",                       icon: <Shield size={15}/>,     bigIcon: <Shield size={26}/>,     cls: "pink"   },
    { id: "logs",       label: "Activity Log", desc: "See who did what, and when",                  icon: <History size={15}/>,    bigIcon: <History size={26}/>,    cls: "slate"  },
  ];

  const currentTabLabel = tabs.find(t => t.id === tab)?.label || "Dashboard";
  const visibleDashboardCards = tabs.filter(t =>
    !dashboardSearch.trim() || t.label.toLowerCase().includes(dashboardSearch.trim().toLowerCase())
  );

  return (
    <div className={`admin-panel${tab !== null ? " has-nav" : ""}`}>

      {/* ── Fixed WhatsApp-style top bar: avatar, admin name, current page title, three-dot menu ── */}
      <header className="ap-topbar">
        <div className="ap-topbar-avatar-wrap">
          <button
            className="ap-topbar-avatar"
            onClick={() => adminPhoto ? setViewerPhoto({ src: adminPhoto, name: adminEmail }) : handleAdminPhotoClick()}
            aria-label={adminPhoto ? "View profile photo" : "Add profile photo"}
            type="button"
          >
            {adminPhoto ? <img src={adminPhoto} alt={adminEmail}/> : <span>{adminInitials}</span>}
          </button>
          <button
            className="ap-topbar-avatar-camera"
            onClick={handleAdminPhotoClick}
            disabled={photoUploading}
            aria-label="Change profile photo"
            type="button"
          >
            {photoUploading ? <Loader2 size={10} className="spin"/> : <Camera size={10}/>}
          </button>
          <input ref={adminPhotoInputRef} type="file" accept="image/*" hidden onChange={handleAdminPhotoFileChange}/>
        </div>

        {tab !== null && (
          <button
            className="ap-topbar-back"
            onClick={goToDashboard}
            aria-label="Back to dashboard"
            type="button"
          >
            <ChevronLeft size={22}/>
          </button>
        )}

        <span className="ap-topbar-title">{tab === null ? adminEmail : currentTabLabel}</span>

        <div className="ap-topbar-menu" ref={menuRef}>
          <button
            className="ap-topbar-menu-btn"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="More options"
            aria-haspopup="true"
            aria-expanded={menuOpen}
            type="button"
          >
            <MoreVertical size={22}/>
          </button>

          {menuOpen && (
            <div className="ap-topbar-dropdown" role="menu">
              <button role="menuitem" type="button" onClick={() => { setMenuOpen(false); handleAdminPhotoClick(); }}>
                <Camera size={16}/>
                <span>{adminPhoto ? "Change Photo" : "Add Photo"}</span>
              </button>
              <button role="menuitem" type="button" onClick={() => { setMenuOpen(false); exportExcel(); }}>
                <Download size={16}/>
                <span>Export Tutors</span>
              </button>
              <button role="menuitem" type="button" className="danger" onClick={() => { setMenuOpen(false); handleLogout(); }}>
                <LogOut size={16}/>
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Nav: left sidebar on desktop/tablet only. On mobile, navigation
          happens entirely through the dashboard cards + back button below —
          no more tiny bottom-bar icons. ── */}
      {tab !== null && (
        <nav className="ap-nav">
          {tabs.map(t => (
            <button key={t.id} className={`ap-tab ${tab === t.id ? "active" : ""}`} onClick={() => openSection(t.id)}>
              {t.icon} <span>{t.label}</span>
            </button>
          ))}
        </nav>
      )}

      <div className="ap-content">

        {/* ── Toast ── */}
        {msg && <div className={`ap-toast ${msgType}`}>{msg}</div>}

        {/* ══════════════ DASHBOARD ══════════════ */}
        {tab === null && (
          <div className="ap-dashboard">
            <div className="ap-dashboard-search">
              <Search size={18}/>
              <input
                className="ap-dashboard-search-input"
                placeholder="Search…  e.g. Students, Categories"
                value={dashboardSearch}
                onChange={e => setDashboardSearch(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && visibleDashboardCards.length === 1) openSection(visibleDashboardCards[0].id); }}
              />
              {dashboardSearch && (
                <button type="button" className="ap-dashboard-search-clear" aria-label="Clear search" onClick={() => setDashboardSearch("")}>
                  <X size={16}/>
                </button>
              )}
            </div>

            {visibleDashboardCards.length === 0 ? (
              <div className="ap-empty">No section matches "{dashboardSearch}".</div>
            ) : (
              <div className="ap-dashboard-grid">
                {visibleDashboardCards.map(t => (
                  <button key={t.id} className="ap-dashboard-card" onClick={() => openSection(t.id)} type="button">
                    <div className={`ap-dashboard-card-icon ${t.cls}`}>{t.bigIcon}</div>
                    <span className="ap-dashboard-card-label">{t.label}</span>
                    <span className="ap-dashboard-card-desc">{t.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {sectionLoading && <div className="ap-empty" style={{ margin: "1rem 0" }}>Loading…</div>}

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
                        onChange={e => { setStudentSearch(e.target.value); fetchStudentsDebounced({ search: e.target.value }); }}
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
                <h3>Students {studentsEverLoaded && <span style={{ color: "var(--ap-muted)", fontWeight: 400 }}>({students.length})</span>}</h3>
              </div>

              <div className="ap-table-wrap">
                {!studentsEverLoaded ? (
                  <div className="ap-empty">Search by name, register number, or email above — or pick a batch/branch — to load students.</div>
                ) : students.length === 0 ? <div className="ap-empty">No students found.</div> : (
                  <table className="ap-table">
                    <thead><tr>
                      <th>Photo</th><th>Name</th><th>Register No.</th><th>Email</th><th>Batch</th><th>Branch</th><th>Lateral Entry</th><th>Points</th><th>Actions</th>
                    </tr></thead>
                    <tbody>
                      {students.map(s => (
                        <tr key={s._id}>
                          <td><AvatarThumb src={s.profilePhoto} name={s.name} onClick={() => setViewerPhoto({ src: s.profilePhoto, name: s.name })}/></td>
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
                    <div className="ap-field">
                      <label>Role</label>
                      <select className="ap-select" value={tutorForm.role} onChange={e => setTutorForm({ ...tutorForm, role: e.target.value })}>
                        <option value="tutor">Tutor (own batch + branch)</option>
                        <option value="hod">HOD (whole department)</option>
                        <option value="principal">Principal (everything)</option>
                      </select>
                    </div>
                    <div className="ap-field">
                      <label>Batch{tutorForm.role === "tutor" && " *"}</label>
                      <select className="ap-select" value={tutorForm.batchId} onChange={e => setTutorForm({ ...tutorForm, batchId: e.target.value })} disabled={tutorForm.role === "hod" || tutorForm.role === "principal"} required={tutorForm.role === "tutor"}>
                        <option value="">Select batch</option>
                        {batches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                      </select>
                    </div>
                    <div className="ap-field">
                      <label>Branch{tutorForm.role !== "principal" && " *"}</label>
                      <select className="ap-select" value={tutorForm.branchId} onChange={e => setTutorForm({ ...tutorForm, branchId: e.target.value })} disabled={tutorForm.role === "principal"} required={tutorForm.role !== "principal"}>
                        <option value="">Select branch</option>
                        {branches.map(br => <option key={br._id} value={br._id}>{br.name}</option>)}
                      </select>
                    </div>
                    {(tutorForm.role === "hod" || tutorForm.role === "principal") && (
                      <p style={{ fontSize: "0.8rem", color: "var(--ap-muted)", margin: "-0.25rem 0 0.5rem" }}>
                        {tutorForm.role === "hod"
                          ? "HOD sees every batch within the branch you pick above."
                          : "Principal sees every batch and branch — nothing to pick here."}
                      </p>
                    )}
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
                    CSV columns: <strong>name, email, password, role, batch, branch</strong><br/>
                    <span style={{ fontSize: "0.78rem" }}>
                      role is <code>tutor</code>, <code>hod</code>, or <code>principal</code>. batch/branch are the exact <strong>names</strong> (not IDs) — leave batch blank for hod/principal, leave both blank for principal.
                    </span>
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
                      <th>Photo</th><th>Name</th><th>Email</th><th>Role</th><th>Batch</th><th>Branch</th><th>Actions</th>
                    </tr></thead>
                    <tbody>
                      {tutors.map(t => (
                        <tr key={t._id}>
                          <td><AvatarThumb src={t.profilePhoto} name={t.name} onClick={() => setViewerPhoto({ src: t.profilePhoto, name: t.name })}/></td>
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

        {/* ══════════════ ADMINS ══════════════ */}
        {tab === "admins" && (
          <div>
            <div className="ap-card" style={{ maxWidth: 480, marginBottom: "1.5rem" }}>
              <div className="ap-card-header">
                <div className="ap-card-icon purple"><Shield size={16}/></div>
                <h3>Add Admin</h3>
              </div>
              <div className="ap-card-body">
                <p style={{ fontSize: "0.85rem", color: "var(--ap-muted)", marginBottom: "1rem" }}>
                  Admins have full access to this panel — only add people you trust with that.
                </p>
                <form onSubmit={handleAdminCreate} className="ap-form">
                  <div className="ap-field"><label>Email</label><input type="email" placeholder="admin@college.edu" value={adminForm.email} className="ap-input" required onChange={e => setAdminForm({ ...adminForm, email: e.target.value })}/></div>
                  <div className="ap-field"><label>Password</label><input type="password" placeholder="At least 8 characters" value={adminForm.password} className="ap-input" required minLength={8} onChange={e => setAdminForm({ ...adminForm, password: e.target.value })}/></div>
                  <button className="btn-primary ap-btn" type="submit"><Shield size={15}/> Create Admin</button>
                </form>
              </div>
            </div>

            <div className="ap-card">
              <div className="ap-card-header">
                <div className="ap-card-icon purple"><Shield size={16}/></div>
                <h3>All Admins <span style={{ color: "var(--ap-muted)", fontWeight: 400 }}>({admins.length})</span></h3>
              </div>
              <div className="ap-table-wrap">
                {admins.length === 0 ? <div className="ap-empty">No admins found.</div> : (
                  <table className="ap-table">
                    <thead><tr><th>Photo</th><th>Email</th><th>Actions</th></tr></thead>
                    <tbody>
                      {admins.map(a => (
                        <tr key={a._id}>
                          <td><AvatarThumb src={a.profilePhoto} name={a.email} onClick={() => setViewerPhoto({ src: a.profilePhoto, name: a.email })}/></td>
                          <td style={{ fontWeight: 600 }}>
                            {a.email}{a._id === currentAdminId && <span className="ap-badge assigned" style={{ marginLeft: "0.5rem" }}>You</span>}
                          </td>
                          <td>
                            <div className="ap-table-actions">
                              <button
                                onClick={() => handleDeleteAdmin(a._id, a.email)}
                                className="btn ap-btn sm danger"
                                disabled={admins.length <= 1}
                                title={admins.length <= 1 ? "Can't delete the last remaining admin" : "Delete admin"}
                              >
                                <Trash2 size={13}/> Delete
                              </button>
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

        {/* ══════════════ ACTIVITY LOG ══════════════ */}
        {tab === "logs" && (
          <div>
            <div className="ap-card" style={{ marginBottom: "1.5rem" }}>
              <div className="ap-card-header">
                <div className="ap-card-icon blue"><History size={16}/></div>
                <h3>Activity Log <span style={{ color: "var(--ap-muted)", fontWeight: 400 }}>({logTotal})</span></h3>
              </div>
              <div className="ap-card-body">
                <p style={{ fontSize: "0.85rem", color: "var(--ap-muted)", marginBottom: "1rem" }}>
                  Every login and change made by students, tutors, and admins — who did it and when. This log is
                  read-only: nothing here can be edited or deleted from within the app.
                </p>

                <form onSubmit={applyLogFilters} className="ap-log-filters">
                  <div className="ap-field">
                    <label>Who</label>
                    <select
                      className="ap-select"
                      value={logFilters.actorType}
                      onChange={e => setLogFilters({ ...logFilters, actorType: e.target.value })}
                    >
                      <option value="">Everyone</option>
                      <option value="admin">Admins</option>
                      <option value="tutor">Tutors</option>
                      <option value="student">Students</option>
                      <option value="system">System</option>
                    </select>
                  </div>

                  <div className="ap-field">
                    <label>Action</label>
                    <select
                      className="ap-select"
                      value={logFilters.action}
                      onChange={e => setLogFilters({ ...logFilters, action: e.target.value })}
                    >
                      <option value="">All actions</option>
                      {logActions.map(a => (
                        <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                  </div>

                  <div className="ap-field">
                    <label>From</label>
                    <input type="date" className="ap-input" value={logFilters.from}
                      onChange={e => setLogFilters({ ...logFilters, from: e.target.value })}/>
                  </div>

                  <div className="ap-field">
                    <label>To</label>
                    <input type="date" className="ap-input" value={logFilters.to}
                      onChange={e => setLogFilters({ ...logFilters, to: e.target.value })}/>
                  </div>

                  <div className="ap-field" style={{ flex: "1 1 220px" }}>
                    <label>Search</label>
                    <input type="text" className="ap-input" placeholder="Name, email, description…"
                      value={logFilters.search}
                      onChange={e => setLogFilters({ ...logFilters, search: e.target.value })}/>
                  </div>

                  <div className="ap-log-filter-actions">
                    <button type="submit" className="btn-primary ap-btn sm"><Filter size={13}/> Apply</button>
                    <button type="button" className="ap-btn sm" onClick={clearLogFilters}>Clear</button>
                    <button type="button" className="ap-btn sm" onClick={exportLogsCsv}><Download size={13}/> Export CSV</button>
                  </div>
                </form>
              </div>
            </div>

            <div className="ap-card">
              <div className="ap-table-wrap">
                {logsLoading ? (
                  <div className="ap-empty">Loading…</div>
                ) : !logsEverLoaded ? (
                  <div className="ap-empty">Set any filters you want above, then tap <strong>Apply</strong> to load the activity log.</div>
                ) : logs.length === 0 ? (
                  <div className="ap-empty">No matching activity found.</div>
                ) : (
                  <table className="ap-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Who</th>
                        <th>Action</th>
                        <th>Details</th>
                        <th>Target</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map(l => (
                        <tr key={l._id}>
                          <td style={{ whiteSpace: "nowrap", fontSize: "0.8rem", color: "var(--ap-muted)" }}>
                            {new Date(l.createdAt).toLocaleString()}
                          </td>
                          <td>
                            <span className={`ap-badge ${actorBadgeClass(l.actorType)}`}>{l.actorType}</span>
                            <div style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>
                              {l.actorName || l.actorEmail || "—"}
                            </div>
                          </td>
                          <td style={{ fontSize: "0.8rem" }}>{l.action.replace(/_/g, " ")}</td>
                          <td style={{ maxWidth: 360 }}>{l.description}</td>
                          <td style={{ fontSize: "0.8rem", color: "var(--ap-muted)" }}>
                            {l.targetName ? `${l.targetType || ""}: ${l.targetName}` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {logPages > 1 && (
                <div className="ap-log-pagination">
                  <button
                    className="ap-btn sm"
                    disabled={logPage <= 1}
                    onClick={() => fetchLogs({ page: logPage - 1 })}
                  >
                    <ChevronLeft size={14}/> Prev
                  </button>
                  <span>Page {logPage} of {logPages}</span>
                  <button
                    className="ap-btn sm"
                    disabled={logPage >= logPages}
                    onClick={() => fetchLogs({ page: logPage + 1 })}
                  >
                    Next <ChevronRight size={14}/>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Crop tool shown before confirming a newly picked admin photo */}
      <PhotoCropModal
        file={pendingAdminPhoto}
        uploading={photoUploading}
        error={photoError}
        onCancel={() => setPendingAdminPhoto(null)}
        onConfirm={confirmAdminPhotoUpload}
      />

      {/* Tap-to-enlarge viewer, shared by the top bar avatar and every
          photo thumbnail in the students/tutors/admins tables */}
      {viewerPhoto && (
        <div className="ap-avatar-lightbox" onClick={() => setViewerPhoto(null)} role="dialog" aria-modal="true">
          <button className="ap-avatar-lightbox-close" onClick={() => setViewerPhoto(null)} aria-label="Close" type="button">
            <X size={22}/>
          </button>
          <div className="ap-avatar-lightbox-content" onClick={e => e.stopPropagation()}>
            {viewerPhoto.src ? (
              <img src={viewerPhoto.src} alt={viewerPhoto.name || "Profile"}/>
            ) : (
              <span className="ap-avatar-fallback-lg">{getInitials(viewerPhoto.name)}</span>
            )}
          </div>
          {viewerPhoto.name && <p className="ap-avatar-lightbox-label">{viewerPhoto.name}</p>}
        </div>
      )}
    </div>
  );
}
