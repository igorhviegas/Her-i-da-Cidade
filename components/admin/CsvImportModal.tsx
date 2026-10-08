import { logger } from '../../lib/logger.js';
import React, { useState } from 'react';
import Papa from 'papaparse';
import { importVideosFromCSV } from '../../services/videosService';
import { CsvImportResult, CsvImportResultBox, CsvPreviewTable, normalizeCsvRow } from './videoAdmin/csvImportParts';

interface Props {
  onClose: () => void;
}

const CsvImportModal: React.FC<Props> = ({ onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<Array<unknown>>([]);
  const [importResult, setImportResult] = useState<CsvImportResult | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setPreviewData([]);
    }
  };

  const parseCsvFile = (file: File): Promise<Array<unknown>> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          complete: (result) => resolve(result.data as Array<unknown>),
          error: (err) => reject(err),
        });
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  };

  const handlePreview = async () => {
    if (!file) {
      setError('Selecione um arquivo CSV');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const parsedData = await parseCsvFile(file);
      const normalized = parsedData.map(normalizeCsvRow);
      setPreviewData(normalized);
    } catch (err) {
      setError(err.message ?? 'Falha ao ler o CSV');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    if (!previewData.length) {
      setError('Nenhum dado para importar');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await importVideosFromCSV(previewData);
      setImportResult(result);
    } catch (e) {
      logger.error(e);
      setError('Erro ao importar CSV');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
<div className="bg-[#0D1527] rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/10 shadow-xl text-white flex flex-col">
        <h2 className="text-xl font-bold mb-4">Importar CSV de Vídeos</h2>
        {error && <p className="text-red-400 mb-2">{error}</p>}
        {!previewData.length && (
          <div className="space-y-3">
            <input type="file" accept=".csv" onChange={handleFileChange} className="w-full text-white" />
            <div className="flex justify-end space-x-2 mt-4">
              <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-500 transition">
                Cancelar
              </button>
              <button type="button" onClick={handlePreview} disabled={loading} className="px-4 py-2 bg-emerald-600 rounded hover:bg-emerald-500 transition">
                {loading ? 'Processando…' : 'Preview'}
              </button>
            </div>
          </div>
        )}
        {previewData.length > 0 && (
          <div className="flex flex-col flex-1 mt-4">
            <p className="mb-2">{previewData.length} registros encontrados</p>
            <div className="flex-1 overflow-y-auto">
              <CsvPreviewTable previewData={previewData} />
            </div>
            <div className="flex justify-end space-x-2 mt-4">
              <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-500 transition">
                Fechar
              </button>
              <button type="button" onClick={handleContinue} className="px-4 py-2 bg-emerald-600 rounded hover:bg-emerald-500 transition">
                Continuar
              </button>
            </div>
            {importResult && <CsvImportResultBox importResult={importResult} />}
          </div>
        )}
      </div>
    </div>
  );
};

export default CsvImportModal;
