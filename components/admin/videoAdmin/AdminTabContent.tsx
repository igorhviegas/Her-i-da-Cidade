import React from 'react';
import { AdminServices } from '../AdminServices';
import { AdminSettings } from '../AdminSettings';
import { AdminVideosPage } from '../AdminVideosPage';
import { AdminCategoriesPage } from '../AdminCategoriesPage';
import { AdminContentPage } from '../AdminContentPage';
import { AdminOrdersPage } from '../AdminOrdersPage';
import { AdminClientsPage } from '../AdminClientsPage';
import { AdminMissionsPage } from '../AdminMissionsPage';
import { AdminFinancePage } from '../AdminFinancePage';
import { AdminCalendarPage } from '../AdminCalendarPage';
import { AdminVideoCallsPage } from '../AdminVideoCallsPage';
import { AdminInstagramPage } from '../AdminInstagramPage';
import { AdminAgentPage } from '../AdminAgentPage';
import { AdminProfilePage } from '../AdminProfilePage';
import { AdminKartPage } from '../AdminKartPage';
import { AdminClientAreaPage } from '../AdminClientAreaPage';
import { AdminFitPage } from '../AdminFitPage';
import { AdminFitCheckinsPage } from '../AdminFitCheckinsPage';
import { AdminFitWorkoutsPage } from '../AdminFitWorkoutsPage';
import { AdminCreativePage } from '../creative/AdminCreativePage';
import { CREATIVE_HOME, CREATIVE_TOOLS } from '../creative/creativeTools';
import type { AdminTab } from './dashboardTypes';

interface AdminTabContentProps {
  currentTab: AdminTab;
}

export const AdminTabContentPrimary: React.FC<AdminTabContentProps> = ({ currentTab }) => (
  <>
    {currentTab === 'calendar' && <AdminCalendarPage />}
    {currentTab === 'videocalls' && <AdminVideoCallsPage />}
    {currentTab === 'profile' && <AdminProfilePage />}

    {/* TAB: SERVIÇOS (ETAPA 4) */}
    {currentTab === 'services' && (
      <AdminServices />
    )}

      {/* TAB: CONFIGURAÇÕES */}
      {currentTab === 'content' && <AdminContentPage />}
      {currentTab === 'settings' && (
      <AdminSettings />
    )}
    {currentTab === 'videos' && (
      <AdminVideosPage />
    )}
    {currentTab === 'categories' && (
      <AdminCategoriesPage />
    )}
  </>
);

export const AdminTabContentSecondary: React.FC<AdminTabContentProps> = ({ currentTab }) => (
  <>
    {currentTab === 'orders' && <AdminOrdersPage />}
    {currentTab === 'clients' && <AdminClientsPage />}
    {currentTab === CREATIVE_HOME.id && <AdminCreativePage />}
    {CREATIVE_TOOLS.map(({ id, Page }) => currentTab === id && <Page key={id} />)}
    {currentTab === 'missions' && <AdminMissionsPage />}
    {currentTab === 'finance' && <AdminFinancePage />}
    {currentTab === 'instagram' && <AdminInstagramPage />}
    {currentTab === 'agent' && <AdminAgentPage />}
    {currentTab === 'fit' && <AdminFitPage />}
    {currentTab === 'fitcheckins' && <AdminFitCheckinsPage />}
    {currentTab === 'fittreinos' && <AdminFitWorkoutsPage />}
    {currentTab === 'kart' && <AdminKartPage />}
    {currentTab === 'clientarea' && <AdminClientAreaPage />}
  </>
);
