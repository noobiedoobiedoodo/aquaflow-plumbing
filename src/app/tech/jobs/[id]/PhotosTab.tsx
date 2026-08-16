'use client';

import { useState, useRef } from 'react';
import { Camera, Upload, Trash2, Eye, EyeOff, Plus, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { uploadJobPhoto, deleteJobPhoto } from '@/app/actions/tech';

interface JobPhotoItem {
  id: string;
  storageKey: string;
  url: string;
  type: string;
  caption?: string | null;
  customerVisible: boolean;
  createdAt: string | Date;
}

export function PhotosTab({ job }: { job: any }) {
  const [photos, setPhotos] = useState<JobPhotoItem[]>(job.photos || []);
  const [isUploading, setIsUploading] = useState(false);
  const [photoType, setPhotoType] = useState<'BEFORE' | 'AFTER' | 'DIAGNOSTIC' | 'OTHER'>('DIAGNOSTIC');
  const [caption, setCaption] = useState('');
  const [customerVisible, setCustomerVisible] = useState(true);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      toast.error('Only PNG, JPEG, and WebP images are allowed.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image size must be 10MB or less.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;
      setSelectedPreview(base64Data);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedPreview) {
      toast.error('Please select or capture a photo first.');
      return;
    }

    setIsUploading(true);
    try {
      const newPhoto = await uploadJobPhoto(
        job.id,
        selectedPreview,
        photoType,
        caption,
        customerVisible
      );
      toast.success('Photo uploaded successfully!');
      setPhotos((prev) => [newPhoto, ...prev]);
      setSelectedPreview(null);
      setCaption('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload photo.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (photoId: string) => {
    if (!confirm('Are you sure you want to delete this photo?')) return;

    try {
      await deleteJobPhoto(job.id, photoId);
      toast.success('Photo deleted.');
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete photo.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Box */}
      <div className="glass p-5 rounded-2xl border border-border/50 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Camera className="w-4 h-4 text-primary-blue" />
            Capture / Upload Photo
          </h3>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
          id="photo-upload-input"
        />

        {!selectedPreview ? (
          <label
            htmlFor="photo-upload-input"
            className="flex flex-col items-center justify-center border-2 border-dashed border-border/60 hover:border-primary-blue/60 rounded-xl p-6 cursor-pointer bg-white/5 hover:bg-white/10 transition-all text-center"
          >
            <Camera className="w-8 h-8 text-primary-blue mb-2" />
            <span className="text-sm font-medium text-white">Tap to take photo or browse library</span>
            <span className="text-xs text-muted-text mt-1">PNG, JPEG, WebP up to 10MB</span>
          </label>
        ) : (
          <div className="space-y-4">
            <div className="relative rounded-xl overflow-hidden max-h-60 bg-black flex items-center justify-center border border-border/50">
              <img
                src={selectedPreview}
                alt="Upload preview"
                className="max-h-60 w-auto object-contain"
              />
              <button
                type="button"
                onClick={() => {
                  setSelectedPreview(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black text-white rounded-full transition-colors text-xs"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-text uppercase tracking-wider block mb-1">
                  Photo Category
                </label>
                <select
                  value={photoType}
                  onChange={(e) => setPhotoType(e.target.value as any)}
                  className="w-full bg-secondary-bg/80 border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-blue"
                >
                  <option value="BEFORE">Before Repair</option>
                  <option value="AFTER">After Repair</option>
                  <option value="DIAGNOSTIC">Diagnostic</option>
                  <option value="OTHER">General</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-text uppercase tracking-wider block mb-1">
                  Customer Visible
                </label>
                <button
                  type="button"
                  onClick={() => setCustomerVisible(!customerVisible)}
                  className={`w-full py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 border transition-colors ${
                    customerVisible
                      ? 'bg-success/15 border-success/40 text-success'
                      : 'bg-white/5 border-border text-muted-text'
                  }`}
                >
                  {customerVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  {customerVisible ? 'Visible in Portal' : 'Internal Only'}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-text uppercase tracking-wider block mb-1">
                Caption / Description (Optional)
              </label>
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="e.g. Corroded P-trap before replacement"
                className="w-full bg-secondary-bg/80 border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-blue"
              />
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={handleUpload}
                disabled={isUploading}
                className="flex-1 bg-primary-blue hover:bg-primary-blue/90 text-white font-bold"
              >
                {isUploading ? 'Uploading...' : 'Save & Attach Photo'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setSelectedPreview(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Gallery Section */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-muted-text uppercase tracking-wider">
          Job Photos ({photos.length})
        </h4>

        {photos.length === 0 ? (
          <div className="glass p-8 rounded-2xl border border-border/50 text-center">
            <Camera className="w-8 h-8 text-muted-text mx-auto mb-2 opacity-50" />
            <p className="text-sm text-muted-text">No photos attached to this job yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="glass rounded-xl border border-border/50 overflow-hidden flex flex-col group"
              >
                <div className="relative aspect-video bg-black/40 overflow-hidden flex items-center justify-center">
                  <img
                    src={`/api/files/${photo.storageKey}`}
                    alt={photo.caption || 'Job photo'}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-black/70 text-white backdrop-blur-md">
                    {photo.type}
                  </span>
                  {photo.customerVisible && (
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md text-[10px] font-bold bg-success/80 text-black backdrop-blur-md">
                      Portal
                    </span>
                  )}
                </div>

                <div className="p-3 flex items-start justify-between gap-2 flex-1 bg-secondary-bg/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white font-medium truncate">
                      {photo.caption || 'No caption provided'}
                    </p>
                    <p className="text-[10px] text-muted-text mt-0.5">
                      {new Date(photo.createdAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(photo.id)}
                    className="text-muted-text hover:text-red-400 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                    title="Delete photo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
