import React, { useState } from 'react';
import Papa from 'papaparse';
import { importVideosFromCSV } from '../../services/videosService';

interface Props {
  onClose: () => void;
}

const CsvImportModal: React.FC<Props> = ({ onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<Array<any>>([]);
  const [importResult, setImportResult] = useState<{created: number; updated: number; errors: number; errorDetails: any[]} | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setPreviewData([]);
    }
  };

  const parseCsvFile = (file: File): Promise<Array<any>> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          complete: (result) => resolve(result.data as Array<any>),
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
      const normalized = parsedData.map((row) => ({
        'Nº': row['Nº'] ?? row['Numero'] ?? row['Number'] ?? '',
        Tema: row['Tema'] ?? row['title'] ?? row['Title'] ?? '',
        Categoria: row['Categoria'] ?? row['category'] ?? row['Category'] ?? '',
        'Link do Reel': row['Link do Reel'] ?? row['link'] ?? row['instagramUrl'] ?? row['InstagramUrl'] ?? '',
        Thumbnail: row['Thumbnail'] ?? row['thumbnail'] ?? row['thumbnailUrl'] ?? row['Thumbnail Url'] ?? '',
        ID: row['ID'] ?? row['Id'] ?? '',
        'Palavras-chave / Pesquisa': row['Palavras-chave / Pesquisa'] ?? row['keywords'] ?? '',
      }));
      setPreviewData(normalized);
    } catch (err: any) {
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
      console.error(e);
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
              <table className="min-w-full table-auto border border-gray-700">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="px-3 py-2 text-left">Nº</th>
                    <th className="px-3 py-2 text-left">Tema</th>
                    <th className="px-3 py-2 text-left">Categoria</th>
                    <th className="px-3 py-2 text-left">Thumbnail</th>
                    <th className="px-3 py-2 text-left">Link do Reel</th>
                    <th className="px-3 py-2 text-left">ID</th>
                    <th className="px-3 py-2 text-left">Palavras-chave / Pesquisa</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800'}>
                      <td className="px-3 py-1 whitespace-nowrap">{row['Nº']}</td>
                      <td className="px-3 py-1 whitespace-nowrap">{row['Tema']}</td>
                      <td className="px-3 py-1 whitespace-nowrap">{row['Categoria']}</td>
                      <td className="px-3 py-1 whitespace-nowrap max-w-[140px] truncate text-xs" title={row['Thumbnail']}>
                        {row['Thumbnail'] ? (
                          <span className="text-emerald-400 font-mono text-[11px] truncate block">{row['Thumbnail']}</span>
                        ) : (
                          <span className="text-white/30 italic text-[11px]">Sem thumbnail</span>
                        )}
                      </td>
                      <td className="px-3 py-1 whitespace-nowrap break-all">{row['Link do Reel']}</td>
                      <td className="px-3 py-1 whitespace-nowrap">{row['ID']}</td>
                      <td className="px-3 py-1 whitespace-nowrap">{row['Palavras-chave / Pesquisa']}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end space-x-2 mt-4">
              <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-500 transition">
                Fechar
              </button>
              <button type="button" onClick={handleContinue} className="px-4 py-2 bg-emerald-600 rounded hover:bg-emerald-500 transition">
                Continuar
              </button>
            </div>
            {importResult && (
              <div className="mt-4 p-4 bg-gray-800 rounded">
                <p className="text-green-400 mb-2">Importação concluída</p>
                <p>Criados: {importResult.created}</p>
                <p>Atualizados: {importResult.updated}</p>
                <p>Erros: {importResult.errors}</p>
                {importResult.errorDetails.length > 0 && (
                  <details className="mt-2 text-sm">
                    <summary>Detalhes dos erros</summary>
                    {importResult.errorDetails.map((e, i) => (
                      <p key={i}>Linha {e.rowIndex}: {e.error?.message || String(e.error)}</p>
                    ))}
                  </details>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CsvImportModal;
