import { useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import AdminCarrerasForm from '@/components/AdminCarrerasForm';
import AdminPanel from '@/components/AdminPanel';

export default function AdminPage() {
  return (
    <ProtectedRoute>
      <AdminPanel />
    </ProtectedRoute>
  );
}