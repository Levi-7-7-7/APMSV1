import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, FileUp, ListChecks, BookOpen } from 'lucide-react';

const navItems = [
  { id: 'students', icon: Users, label: 'Students', path: '/tutor/dashboard/students' },
  { id: 'upload', icon: FileUp, label: 'Upload CSV', path: '/tutor/dashboard/upload' },
  { id: 'pending', icon: ListChecks, label: 'Pending Certificates', path: '/tutor/dashboard/pending' },
  { id: 'approved', icon: BookOpen, label: 'Approved Certificates', path: '/tutor/dashboard/approved' },
];

export default function TutorBottomNav({ activeTab }) {
  const navigate = useNavigate();

  return (
    <div className="bottom-nav">
      {navItems.map(({ id, icon: Icon, label, path }) => (
        <button
          key={id}
          onClick={() => navigate(path)}
          className={`nav-btn ${activeTab === id ? 'active' : ''}`}
          type="button"
        >
          <Icon size={24} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
