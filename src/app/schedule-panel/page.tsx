import React from 'react';
import AppLayout from '@/components/AppLayout';
import SchedulePanelContent from './components/SchedulePanelContent';

export default function SchedulePanelPage() {
  return (
    <AppLayout activeRoute="/schedule-panel">
      <SchedulePanelContent />
    </AppLayout>
  );
}