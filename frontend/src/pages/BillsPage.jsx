import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { billsAPI, categoriesAPI } from '../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Plus, Edit, Trash2, CheckCircle, XCircle, Filter, Search } from 'lucide-react';
import BillModal from '../components/BillModal';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import Header from '../components/Header';
import Footer from '../components/Footer.jsx';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';

export default function BillsPage() {
  // ...restante do código do BillsPage.js...
  return (
    <div className="min-h-screen flex flex-col app-container">
      <Header />
      {/* ...restante do JSX... */}
      <Footer />
    </div>
  );
}
