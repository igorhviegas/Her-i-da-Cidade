import React, { useEffect, useRef, useState } from 'react';
import { uploadServiceImageToVercelBlob } from '../../../services/blobUploadService';

/**
 * Estado e ações do upload de imagem do serviço (seleção, preview, envio ao Vercel Blob).
 * `onUploaded` recebe a URL final para o formulário gravar.
 */
export const useServiceImageUpload = (onUploaded: (imageUrl: string) => void) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const clear = () => {
    setSelectedImage(null);
    setPreviewUrl(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setComplete(false);
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    if (!allowedMimeTypes.includes(file.type) && !allowedExtensions.includes(extension)) {
      setError('Formato não permitido. Utilize arquivos JPG, PNG ou WEBP.');
      event.target.value = '';
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError('O arquivo selecionado excede o limite máximo permitido de 4 MB.');
      event.target.value = '';
      return;
    }

    setSelectedImage(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const upload = async () => {
    if (!selectedImage || isUploading) return;
    setIsUploading(true);
    setError(null);
    try {
      const imageUrl = await uploadServiceImageToVercelBlob(selectedImage);
      onUploaded(imageUrl);
      setSelectedImage(null);
      setPreviewUrl(null);
      setComplete(true);
      if (inputRef.current) inputRef.current.value = '';
    } catch (err) {
      setError((err as { message?: string })?.message || 'Não foi possível enviar a imagem. Tente novamente.');
    } finally {
      setIsUploading(false);
    }
  };

  return { inputRef, selectedImage, previewUrl, isUploading, error, complete, setComplete, clear, onFileChange, upload };
};

export type ServiceImageUpload = ReturnType<typeof useServiceImageUpload>;
