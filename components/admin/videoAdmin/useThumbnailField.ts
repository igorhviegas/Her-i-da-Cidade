import React, { useState, useEffect, useRef } from 'react';
import { Video } from '../../../types';

export const useThumbnailField = (video?: Video | null) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const existingThumbnail = video?.thumbnailUrl || (video?.thumbnail && video.thumbnail.startsWith('http') ? video.thumbnail : null);
  const [removeThumbnail, setRemoveThumbnail] = useState(false);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);

  // Sempre que o modal abrir ou o vídeo mudar, atualizar estados
  useEffect(() => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setRemoveThumbnail(false);
  }, [video]);

  // Limpeza de URL de blob em caso de desmontagem
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setThumbnailError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Formatos permitidos: JPG, JPEG, PNG, WEBP
    const allowedMime = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const allowedExts = ['jpg', 'jpeg', 'png', 'webp'];
    const extension = file.name.split('.').pop()?.toLowerCase() || '';

    if (!allowedMime.includes(file.type) && !allowedExts.includes(extension)) {
      setThumbnailError('Formato não permitido. Utilize arquivos JPG, JPEG, PNG ou WEBP.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Limite máximo de tamanho: 4 MB (compatível com limites serverless da Vercel)
    const MAX_SIZE = 4 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setThumbnailError('O arquivo selecionado excede o limite máximo permitido de 4 MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Sucesso na seleção
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setRemoveThumbnail(false);
  };

  const handleClearSelectedFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setThumbnailError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return {
    fileInputRef, selectedFile, previewUrl, existingThumbnail,
    removeThumbnail, setRemoveThumbnail, thumbnailError, setThumbnailError,
    handleFileChange, handleClearSelectedFile,
  };
};
