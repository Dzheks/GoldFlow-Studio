import React, { useState, useEffect, useRef } from 'react';
import { ViewMode, ProjectData } from './types';
import { INITIAL_PROJECT } from './data/mockData';
import { saveProjectToDb, loadProjectFromDb } from './utils/projectStorage';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { ContentFactory } from './components/ContentFactory';
import { MontageStudio } from './components/MontageStudio';
import { VoiceStudio } from './components/VoiceStudio';
import { ImageStudio } from './components/ImageStudio';
import { VideoStudio } from './components/VideoStudio';
import { AssistantStudio } from './components/AssistantStudio';
import { ThumbnailStudio } from './components/ThumbnailStudio';
import { MyWorks } from './components/MyWorks';
import { AccountModal } from './components/AccountModal';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewMode>('dashboard');
  const [credits, setCredits] = useState<number>(10000); // 10 000 Pro balance
  const [isAccountOpen, setIsAccountOpen] = useState<boolean>(false);
  const [project, setProject] = useState<ProjectData>(INITIAL_PROJECT);
  const isProjectLoadedRef = useRef(false);

  // Load whatever was last autosaved (real disk-backed IndexedDB, not just
  // in-memory state) before letting any change trigger a save — otherwise
  // the very first render's INITIAL_PROJECT would overwrite the saved data.
  useEffect(() => {
    loadProjectFromDb().then((loaded) => {
      if (loaded) setProject(loaded);
      isProjectLoadedRef.current = true;
    });
  }, []);

  useEffect(() => {
    if (!isProjectLoadedRef.current) return;
    const timeout = setTimeout(() => saveProjectToDb(project), 400);
    return () => clearTimeout(timeout);
  }, [project]);

  const handleUpdateProject = (updated: Partial<ProjectData>) => {
    setProject((prev) => ({ ...prev, ...updated }));
  };

  const handleDeductCredits = (amount: number): boolean => {
    setCredits((prev) => Math.max(0, prev - amount));
    return true;
  };

  const handleAddCredits = (amount: number) => {
    setCredits((prev) => prev + amount);
  };

  const isStudioView = currentView === 'montage' || currentView === 'factory';

  return (
    <div className="min-h-screen bg-[#0d0a08] text-stone-200 flex flex-col font-sans">
      {/* Top GoldFlow Navigation Bar */}
      <Header
        currentView={currentView}
        onNavigate={setCurrentView}
        credits={credits}
        onOpenRecharge={() => setIsAccountOpen(true)}
        projectName={project.name}
        isMontageOrFactory={isStudioView}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {currentView === 'dashboard' && (
          <Dashboard
            onSelectTool={setCurrentView}
            recentProjectName={project.name}
            onOpenRecentProject={() => setCurrentView('montage')}
          />
        )}

        {currentView === 'factory' && (
          <ContentFactory
            project={project}
            onUpdateProject={handleUpdateProject}
            onBack={() => setCurrentView('dashboard')}
            onGoToMontage={() => setCurrentView('montage')}
            onGoToVideo={() => setCurrentView('video')}
            credits={credits}
            onDeductCredits={handleDeductCredits}
          />
        )}

        {currentView === 'montage' && (
          <MontageStudio
            project={project}
            onUpdateProject={handleUpdateProject}
            onBack={() => setCurrentView('dashboard')}
            credits={credits}
            onDeductCredits={handleDeductCredits}
          />
        )}

        {currentView === 'voice' && (
          <VoiceStudio
            onBack={() => setCurrentView('dashboard')}
            onAddVoiceToTimeline={(text, voiceName, audioUrl) => {
              const newClip = {
                id: `clip-voice-${Date.now()}`,
                trackId: 'voice' as const,
                name: `Озвучка: ${voiceName.split(' ')[0]}`,
                startTime: 0,
                duration: Math.max(4, Math.ceil(text.length / 14)),
                color: '#3b82f6',
                text,
                audioUrl,
                volume: 1.0,
              };
              handleUpdateProject({
                timelineClips: [newClip, ...project.timelineClips],
              });
              setCurrentView('montage');
            }}
          />
        )}

        {currentView === 'images' && (
          <ImageStudio
            onBack={() => setCurrentView('dashboard')}
            credits={credits}
            onDeductCredits={handleDeductCredits}
            onOpenRecharge={() => setIsAccountOpen(true)}
            project={project}
            onUpdateProject={handleUpdateProject}
            onGoToMontage={() => setCurrentView('montage')}
          />
        )}

        {currentView === 'video' && (
          <VideoStudio
            onBack={() => setCurrentView('dashboard')}
            credits={credits}
            onDeductCredits={handleDeductCredits}
            onOpenRecharge={() => setIsAccountOpen(true)}
            projectScenes={project.scenes}
            onAddVideoToTimeline={({ title, videoUrl, duration, prompt }) => {
              const maxEndTime = project.timelineClips.reduce(
                (acc, c) => Math.max(acc, c.startTime + c.duration),
                0
              );
              const newClip = {
                id: `clip-veo3-${Date.now()}`,
                trackId: 'video' as const,
                name: title,
                startTime: maxEndTime,
                duration: duration || 5,
                color: '#f59e0b',
                videoUrl,
                imageUrl: videoUrl,
                text: prompt,
                motion: 'zoom-in' as const,
                transition: 'crossfade' as const,
              };
              handleUpdateProject({
                timelineClips: [...project.timelineClips, newClip],
              });
              setCurrentView('montage');
            }}
          />
        )}

        {currentView === 'assistant' && (
          <AssistantStudio
            onBack={() => setCurrentView('dashboard')}
            onSendToFactory={(script) => {
              handleUpdateProject({ scriptText: script });
              setCurrentView('factory');
            }}
          />
        )}

        {currentView === 'preview' && (
          <ThumbnailStudio onBack={() => setCurrentView('dashboard')} />
        )}

        {currentView === 'my-works' && (
          <MyWorks
            onBack={() => setCurrentView('dashboard')}
            onOpenProject={(id) => setCurrentView('montage')}
            onNavigate={setCurrentView}
          />
        )}
      </main>

      {/* Account & Billing Modal */}
      <AccountModal
        isOpen={isAccountOpen}
        onClose={() => setIsAccountOpen(false)}
        credits={credits}
        onAddCredits={handleAddCredits}
      />
    </div>
  );
}
