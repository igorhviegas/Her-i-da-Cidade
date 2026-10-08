import React from 'react';

export const normalizeCsvRowIdentity = (row: unknown) => ({
  'Nº': row['Nº'] ?? row['Numero'] ?? row['Number'] ?? '',
  Tema: row['Tema'] ?? row['title'] ?? row['Title'] ?? '',
  Categoria: row['Categoria'] ?? row['category'] ?? row['Category'] ?? '',
});

export const normalizeCsvRowLinks = (row: unknown) => ({
  'Link do Reel': row['Link do Reel'] ?? row['link'] ?? row['instagramUrl'] ?? row['InstagramUrl'] ?? '',
  Thumbnail: row['Thumbnail'] ?? row['thumbnail'] ?? row['thumbnailUrl'] ?? row['Thumbnail Url'] ?? '',
});

export const normalizeCsvRowKeys = (row: unknown) => ({
  ID: row['ID'] ?? row['Id'] ?? '',
  'Palavras-chave / Pesquisa': row['Palavras-chave / Pesquisa'] ?? row['keywords'] ?? '',
});

export const normalizeCsvRow = (row: unknown) => ({
  ...normalizeCsvRowIdentity(row),
  ...normalizeCsvRowLinks(row),
  ...normalizeCsvRowKeys(row),
});

interface CsvPreviewTableProps {
  previewData: Array<unknown>;
}

export const CsvPreviewTable: React.FC<CsvPreviewTableProps> = ({ previewData }) => (
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
);

export interface CsvImportResult {
  created: number;
  updated: number;
  errors: number;
  errorDetails: unknown[];
}

interface CsvImportResultBoxProps {
  importResult: CsvImportResult;
}

export const CsvImportResultBox: React.FC<CsvImportResultBoxProps> = ({ importResult }) => (
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
);
