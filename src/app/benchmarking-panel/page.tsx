import React from 'react';
import AppLayout from '@/components/AppLayout';
import BenchmarkingPanelContent from './components/BenchmarkingPanelContent';

export default function BenchmarkingPanelPage() {
  return (
    <AppLayout activeRoute="/benchmarking-panel">
      <BenchmarkingPanelContent />
    </AppLayout>
  );
}
