import { ToastProvider, AccountToastFeedback } from '@nihongo/client/toast';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import AdminApp from './AdminApp';
import { useAuth } from '@nihongo/client/auth/useAuth';
import '@nihongo/client/styles/base.css';

function AdminRoot() {
  const auth = useAuth();
  return <ToastProvider variant="admin" scope={auth.currentUser?.id ?? 'guest'}>
    <AccountToastFeedback userId={auth.currentUser?.id ?? null} checking={auth.checking || auth.loggingOut} error={auth.error} />
    <AdminApp auth={auth} />
  </ToastProvider>;
}

const router = createBrowserRouter([{ path: '*', element: <AdminRoot /> }]);
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><RouterProvider router={router} /></React.StrictMode>,
);
