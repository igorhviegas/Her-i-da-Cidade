import React from 'react';
import VideoList from './VideoList';

export const AdminVideosPage: React.FC = () => (
  <div className="space-y-6">
    <h1 className="text-2xl font-bold text-white">VÍDEOS</h1>
    <VideoList />
  </div>
);
