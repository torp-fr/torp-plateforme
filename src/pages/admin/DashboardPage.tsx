/**
 * Analytics Dashboard Page - Main Admin Control Center
 * Modern SaaS cockpit layout with quick actions and live status
 */

import React from 'react';
import { OverviewTab } from '../Analytics';
import { CockpitHeader } from '@/components/admin/CockpitHeader';
import { QuickActions } from '@/components/admin/QuickActions';
import { EngineStatusStrip } from '@/components/admin/EngineStatusStrip';
import { KnowledgeBrainWidget } from '@/components/admin/KnowledgeBrainWidget';

export function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <CockpitHeader />

      <div className="space-y-6">
        <QuickActions />
        <EngineStatusStrip />
        <KnowledgeBrainWidget />
      </div>

      <div className="bg-gradient-to-b from-background to-muted/20">
        <OverviewTab />
      </div>
    </div>
  );
}

export default DashboardPage;
