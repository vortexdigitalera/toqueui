import React from 'react';
import AppLayout from '@/components/AppLayout';
import AuthPanelContent from './components/AuthPanelContent';

export default function AuthenticationPanelPage() {
  return (
    <AppLayout activeRoute="/">
      <AuthPanelContent />
    </AppLayout>
  );
}