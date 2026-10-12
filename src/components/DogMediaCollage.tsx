import React, { useState, useEffect } from 'react';
import { IntakeMediaItem } from '../types';
import { Play, Video, X, ChevronLeft, ChevronRight, Download, Loader2, Maximize2 } from 'lucide-react';
import { supabase } from '../utils/supabase';

interface DogMediaCollageProps {
  mediaList?: IntakeMediaItem[];
  singlePhotoUrl?: string;
  dogName?: string;
  onMediaClick?: (index: number) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const DogMediaCollage: React.FC<DogMediaCollageProps> = ({
  mediaList,
  singlePhotoUrl,
  dogName = 'כלב',
  onMediaClick,
  className = '',
  size = 'md'
}) => {
  // Normalize items
  const items: IntakeMediaItem[] = React.useMemo(() => {
    if (mediaList && mediaList.length > 0) {
      return mediaList;
    }
    if (singlePhotoUrl) {
      return [{
        id: 'single_photo',
        type: 'image',
        url: singlePhotoUrl
      }];
    }
    return [];
  }, [mediaList, singlePhotoUrl]);

  if (items.length === 0) {
    return (
      <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-center font-black text-2xl shadow-xs shrink-0 mt-1">
        🐕
      </div>
    );
  }

  const sizeClasses = {
    sm: 'w-12 h-12 rounded-xl',
    md: 'w-16 h-16 sm:w-20 sm:h-20 rounded-2xl',
    lg: 'w-24 h-24 rounded-2xl'
  }[size];

  const handleClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    if (onMediaClick) {
      onMediaClick(index);
    }
  };

  const renderTileMedia = (item: IntakeMediaItem, idx: number, isOverlay = false, remainingCount = 0) => {
    const isVideo = item.type === 'video';
    const mediaSrc = item.thumbnailUrl || item.url;

    return (
      <div 
        key={item.id || idx}
        onClick={(e) => handleClick(e, idx)}
        className="relative w-full h-full overflow-hidden bg-slate-900 group/tile cursor-pointer"
        title={isVideo ? 'סרטון וידאו של הכלב 🎥' : `תמונה ${idx + 1} 📸`}
      >
        <img
          src={mediaSrc}
          alt={dogName}
          className="w-full h-full object-cover group-hover/tile:scale-105 transition-transform duration-200"
          loading="lazy"
        />

        {/* Video badge */}
        {isVideo && !isOverlay && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover/tile:bg-black/10 transition-colors">
            <div className="w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center shadow-md border border-white/40">
              <Play className="w-3 h-3 fill-white ml-0.5" />
            </div>
            <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1 rounded flex items-center gap-0.5">
              <Video className="w-2.5 h-2.5" />
              {item.duration ? `${item.duration}s` : ''}
            </div>
          </div>
        )}

        {/* +N Remaining Overlay */}
        {isOverlay && (
          <div className="absolute inset-0 bg-black/70 hover:bg-black/60 flex items-center justify-center text-white font-black text-xs sm:text-sm tracking-tight transition-colors">
            +{remainingCount}
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      className={`relative overflow-hidden border-2 border-emerald-400 shadow-xs hover:border-emerald-500 hover:shadow-md transition-all shrink-0 mt-1 select-none ${sizeClasses} ${className}`}
      title="לחצו לצפייה בקולאז' התמונות והווידאו של הכלב 📸🎥"
    >
      {/* 1 Item */}
      {items.length === 1 && (
        <div className="w-full h-full">
          {renderTileMedia(items[0], 0)}
        </div>
      )}

      {/* 2 Items: Side-by-Side Split */}
      {items.length === 2 && (
        <div className="w-full h-full grid grid-cols-2 gap-0.5">
          {renderTileMedia(items[0], 0)}
          {renderTileMedia(items[1], 1)}
        </div>
      )}

      {/* 3 Items: 1 Big Left, 2 Stacked Right */}
      {items.length === 3 && (
        <div className="w-full h-full grid grid-cols-2 gap-0.5">
          <div className="w-full h-full">
            {renderTileMedia(items[0], 0)}
          </div>
          <div className="w-full h-full grid grid-rows-2 gap-0.5">
            {renderTileMedia(items[1], 1)}
            {renderTileMedia(items[2], 2)}
          </div>
        </div>
      )}

      {/* 4 Items: 2x2 Grid */}
      {items.length === 4 && (
        <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-0.5">
          {renderTileMedia(items[0], 0)}
          {renderTileMedia(items[1], 1)}
          {renderTileMedia(items[2], 2)}
          {renderTileMedia(items[3], 3)}
        </div>
      )}

      {/* 5+ Items: 2x2 Grid with +N Overlay on the 4th item */}
      {items.length >= 5 && (
        <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-0.5">
          {renderTileMedia(items[0], 0)}
          {renderTileMedia(items[1], 1)}
          {renderTileMedia(items[2], 2)}
          {renderTileMedia(items[3], 3, true, items.length - 3)}
        </div>
      )}

      {/* Media Count Badge in corner */}
      {items.length > 1 && (
        <div className="absolute top-1 left-1 bg-black/75 backdrop-blur-xs text-white text-[9px] font-black px-1.5 py-0.2 rounded-md shadow-xs pointer-events-none">
          {items.length} 📸
        </div>
      )}
    </div>
  );
};

// =========================================================================
// Lightbox Viewer Modal for Fullscreen Images & Videos
// =========================================================================

interface DogMediaLightboxModalProps {
  isOpen: boolean;
  mediaList: IntakeMediaItem[];
  initialIndex?: number;
  dogName?: string;
  ownerName?: string;
  onClose: () => void;
}

export const DogMediaLightboxModal: React.FC<DogMediaLightboxModalProps> = ({
  isOpen,
  mediaList,
  initialIndex = 0,
  dogName = 'כלב',
  ownerName,
  onClose
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [isLoadingVideo, setIsLoadingVideo] = useState<boolean>(false);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex, isOpen]);

  const currentItem = mediaList[currentIndex];

  // Lazy load video from Supabase settings table if mediaSettingsId is provided
  useEffect(() => {
    if (!isOpen || !currentItem) return;

    if (currentItem.type === 'video') {
      if (currentItem.url && !currentItem.url.startsWith('lazy:')) {
        setVideoSrc(currentItem.url);
        setIsLoadingVideo(false);
      } else if (currentItem.mediaSettingsId) {
        setIsLoadingVideo(true);
        supabase
          .from('settings')
          .select('data')
          .eq('id', currentItem.mediaSettingsId)
          .single()
          .then(({ data, error }) => {
            setIsLoadingVideo(false);
            if (!error && data?.data?.videoDataUrl) {
              setVideoSrc(data.data.videoDataUrl);
            } else {
              console.warn('Could not load lazy video:', error);
            }
          })
          .catch(() => setIsLoadingVideo(false));
      }
    } else {
      setVideoSrc('');
      setIsLoadingVideo(false);
    }
  }, [currentIndex, currentItem, isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        setCurrentIndex(prev => (prev > 0 ? prev - 1 : mediaList.length - 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentIndex(prev => (prev < mediaList.length - 1 ? prev + 1 : 0));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, mediaList.length, onClose]);

  if (!isOpen || !currentItem) return null;

  const handleNext = () => {
    setCurrentIndex(prev => (prev < mediaList.length - 1 ? prev + 1 : 0));
  };

  const handlePrev = () => {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : mediaList.length - 1));
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col justify-between animate-in fade-in select-none"
      onClick={onClose}
    >
      {/* Top Header */}
      <div 
        className="w-full p-4 flex items-center justify-between text-white border-b border-white/10 bg-black/40 z-10"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
            {currentItem.type === 'video' ? <Video className="w-5 h-5" /> : '📸'}
          </div>
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-white flex items-center gap-2">
              <span>{dogName}</span>
              {ownerName && <span className="text-xs text-slate-400 font-normal">({ownerName})</span>}
            </h3>
            <p className="text-xs text-slate-400">
              {currentItem.type === 'video' ? 'סרטון וידאו' : 'תמונה'} {currentIndex + 1} מתוך {mediaList.length}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Download button */}
          {(currentItem.url || videoSrc) && (
            <a
              href={videoSrc || currentItem.url}
              download={`${dogName}_media_${currentIndex + 1}.${currentItem.type === 'video' ? 'mp4' : 'jpg'}`}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="הורד קובץ"
              onClick={e => e.stopPropagation()}
            >
              <Download className="w-4 h-4" />
            </a>
          )}

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-red-500/80 text-white transition-colors cursor-pointer"
            title="סגור (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Media Stage */}
      <div 
        className="flex-1 relative flex items-center justify-center p-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Prev Arrow */}
        {mediaList.length > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 flex items-center justify-center shadow-lg transition-transform hover:scale-110 cursor-pointer"
            title="הקודם (חץ ימינה)"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Media content */}
        <div className="max-w-5xl max-h-[75vh] flex items-center justify-center">
          {currentItem.type === 'image' ? (
            <img
              src={currentItem.url}
              alt={dogName}
              className="max-h-[75vh] max-w-full object-contain rounded-2xl shadow-2xl border border-white/10 animate-in zoom-in-95 duration-200"
            />
          ) : (
            <div className="relative flex items-center justify-center">
              {isLoadingVideo ? (
                <div className="flex flex-col items-center gap-3 p-10 bg-slate-900 rounded-2xl border border-slate-700 text-white">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                  <span className="text-xs font-bold">טוען סרטון וידאו...</span>
                </div>
              ) : videoSrc ? (
                <video
                  src={videoSrc}
                  controls
                  playsInline
                  autoPlay
                  className="max-h-[75vh] max-w-full rounded-2xl shadow-2xl border border-white/10 bg-black"
                />
              ) : (
                <div className="p-8 bg-slate-900 rounded-2xl text-center text-slate-300">
                  <Video className="w-10 h-10 mx-auto mb-2 text-slate-500" />
                  <p className="text-xs">הסרטון אינו זמין כרגע</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Next Arrow */}
        {mediaList.length > 1 && (
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 flex items-center justify-center shadow-lg transition-transform hover:scale-110 cursor-pointer"
            title="הבא (חץ שמאלה)"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Bottom Thumbnail Strip */}
      {mediaList.length > 1 && (
        <div 
          className="w-full p-3 bg-black/50 border-t border-white/10 flex items-center justify-center gap-2 overflow-x-auto z-10"
          onClick={e => e.stopPropagation()}
        >
          {mediaList.map((item, idx) => (
            <button
              key={item.id || idx}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              className={`relative w-12 h-12 rounded-xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                idx === currentIndex ? 'border-emerald-400 scale-105 shadow-md' : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <img
                src={item.thumbnailUrl || item.url}
                alt={`תמונה ${idx + 1}`}
                className="w-full h-full object-cover"
              />
              {item.type === 'video' && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Play className="w-3 h-3 fill-white text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
