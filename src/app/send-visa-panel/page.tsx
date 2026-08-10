import React from 'react';
import AppLayout from '@/components/AppLayout';
import SendVisaPanelContent from './components/SendVisaPanelContent';

export default function SendVisaPanelPage() {
  return (
    <AppLayout activeRoute="/send-visa-panel">
      <SendVisaPanelContent />
    </AppLayout>
  );
}