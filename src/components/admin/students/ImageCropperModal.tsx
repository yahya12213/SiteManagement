import React, { useState, useRef, useEffect } from 'react';
import ReactCrop from 'react-image-crop';
import type { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { X, Upload, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/client';

interface ImageCropperModalProps {
  student: {
    id: string;
    student_id: string;
    student_name?: string;
    profile_image_url?: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  student,
  onClose,
  onSuccess,
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    width: 75,
    height: 100,
    x: 12.5,
    y: 0,
  });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load existing photo if available
  useEffect(() => {
    if (student.profile_image_url) {
      setIsLoadingExisting(true);
      // Use relative path directly - works in both dev (Vite proxy) and production (same domain)
      const fullUrl = student.profile_image_url.startsWith('http')
        ? student.profile_image_url
        : student.profile_image_url;

      setImageSrc(fullUrl);
      setIsLoadingExisting(false);
    }
  }, [student.profile_image_url]);

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageSrc(reader.result?.toString() || null);
        setError(null);
      });
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const getCroppedImg = (
    image: HTMLImageElement,
    crop: PixelCrop
  ): Promise<Blob | null> => {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return Promise.resolve(null);
    }

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width,
      crop.height
    );

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          resolve(blob);
        },
        'image/jpeg',
        0.95
      );
    });
  };

  const handleSave = async () => {
    if (!completedCrop || !imageRef.current) {
      setError('Veuillez sélectionner une zone à recadrer');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const croppedImageBlob = await getCroppedImg(
        imageRef.current,
        completedCrop
      );

      if (!croppedImageBlob) {
        throw new Error('Erreur lors du recadrage de l\'image');
      }

      // Create FormData
      const formData = new FormData();
      formData.append(
        'profile_image',
        croppedImageBlob,
        `profile-${student.student_id}-${Date.now()}.jpg`
      );

      // Update student profile image
      // FormData automatically sets Content-Type to multipart/form-data
      await apiClient.put(`/students/${student.student_id}`, formData);

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error uploading cropped image:', error);
      setError(error.message || 'Erreur lors de la sauvegarde de l\'image');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] sm:w-[700px] md:w-[850px] lg:w-[950px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Upload className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Recadrer la photo
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {student.student_name}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={isSubmitting}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Loading existing photo */}
          {isLoadingExisting && (
            <div className="flex items-center justify-center p-12">
              <div className="flex items-center gap-3">
                <RefreshCw className="h-6 w-6 text-blue-600 animate-spin" />
                <span className="text-gray-600">Chargement de la photo existante...</span>
              </div>
            </div>
          )}

          {/* File input */}
          {!imageSrc && !isLoadingExisting && (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12">
              <div className="text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <div className="mt-4">
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer text-blue-600 hover:text-blue-500 font-medium"
                  >
                    Choisir une photo
                  </label>
                  <input
                    id="file-upload"
                    ref={fileInputRef}
                    type="file"
                    className="sr-only"
                    accept="image/*"
                    onChange={onSelectFile}
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  PNG, JPG, WEBP jusqu'à 3MB
                </p>
              </div>
            </div>
          )}

          {/* Crop area */}
          {imageSrc && (
            <div className="space-y-4">
              <div className="flex justify-center bg-gray-100 p-4 rounded-lg">
                <ReactCrop
                  crop={crop}
                  onChange={(c) => setCrop(c)}
                  onComplete={(c) => setCompletedCrop(c)}
                  aspect={3/4}
                >
                  <img
                    ref={imageRef}
                    src={imageSrc}
                    alt="Crop me"
                    crossOrigin="anonymous"
                    style={{ maxHeight: '400px', maxWidth: '100%' }}
                    onLoad={() => {
                      // Set initial crop when image loads
                      if (imageRef.current && !completedCrop) {
                        const { width, height } = imageRef.current;
                        const cropWidth = Math.min(width * 0.75, height * (3/4));
                        const cropHeight = cropWidth / (3/4);
                        setCompletedCrop({
                          unit: 'px',
                          width: cropWidth,
                          height: cropHeight,
                          x: (width - cropWidth) / 2,
                          y: (height - cropHeight) / 2,
                        });
                      }
                    }}
                  />
                </ReactCrop>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Ajustez le cadre pour recadrer la photo
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setImageSrc(null);
                    setCompletedCrop(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                >
                  Changer de photo
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!imageSrc || isSubmitting}
            className="min-w-[120px]"
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Sauvegarde...</span>
              </div>
            ) : (
              'Enregistrer'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
