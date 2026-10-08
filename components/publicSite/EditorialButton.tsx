import React from 'react';
import { Link } from '../../lib/router';
import { isSafeContentUrl } from '../../services/homeContentService';

interface EditorialButtonProps {
  text?: string;
  url?: string;
  wrapperClassName?: string;
}

export const EditorialButton: React.FC<EditorialButtonProps> = ({ text, url, wrapperClassName }) => {
  const buttonText = text?.trim();
  const buttonUrl = url && isSafeContentUrl(url) ? url : '';
  const button = buttonText && buttonUrl ? (
    buttonUrl.startsWith('/') ? (
      <Link href={buttonUrl} className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3 font-bold text-white transition hover:bg-blue-500">
        {buttonText}
      </Link>
    ) : (
      <a href={buttonUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3 font-bold text-white transition hover:bg-blue-500">
        {buttonText}
      </a>
    )
  ) : null;
  if (!button) return null;
  return wrapperClassName ? <div className={wrapperClassName}>{button}</div> : button;
};
