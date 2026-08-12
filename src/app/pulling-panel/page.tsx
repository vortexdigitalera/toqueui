import React from 'react';
import AppLayout from '@/components/AppLayout';
import PullingPanelContent from './components/PullingPanelContent';
import RoleGuard from '@/components/RoleGuard';

export default function PullingPanelPage() {
  return (
    <AppLayout activeRoute="/pulling-panel">
      <RoleGuard panel="pulling">
        <PullingPanelContent />
      </RoleGuard>
    </AppLayout>
  );
}
