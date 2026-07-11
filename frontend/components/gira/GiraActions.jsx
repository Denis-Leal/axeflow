import { useState } from 'react';
import { Button } from '../ui';
import { exportGira } from '../../services/api';
import { downloadBlob } from '../../utils/download';

const FORMATOS = [
  {
    id: "xlsx",
    label: "Excel",
    icon: "bi-file-earmark-excel",
    ext: "xlsx",
  },
  {
    id: "csv",
    label: "CSV",
    icon: "bi-filetype-csv",
    ext: "csv",
  },
  {
    id: "pdf",
    label: "PDF",
    icon: "bi-file-earmark-pdf",
    ext: "pdf",
  },
  {
    id: "docx",
    label: "Word",
    icon: "bi-file-earmark-word",
    ext: "docx",
  },
];

export default function GiraActions({ giraId, giraNome }) {
  const [exportando, setExportando] = useState(false);
  const [aberto, setAberto] = useState(false);


  async function handleExport(formato) {
    try {
      setExportando(true);
      setAberto(false);

      const response = await exportGira(giraId, formato);

      const extensao = FORMATOS.find(
        f => f.id === formato
      )?.ext;

      downloadBlob(response, `gira-${giraNome}.${extensao}`);

    } catch (error) {
      console.error("Erro ao exportar gira:", error);
    } finally {
      setExportando(false);
    }
  }


  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        marginBottom: '1rem',
        position: 'relative',
      }}
    >

      <Button
        variant="outline"
        size="sm"
        onClick={() => setAberto(!aberto)}
        disabled={exportando}
      >
        <i className="bi bi-download me-1" />

        {exportando
          ? "Exportando..."
          : "Baixar lista consulentes"}

        <i className="bi bi-chevron-down ms-2" />
      </Button>


      {aberto && (
        <div
          style={{
            position: 'absolute',
            top: '40px',
            right: 0,
            background: 'var(--cor-card)',
            border: '1px solid var(--cor-borda)',
            borderRadius: '8px',
            padding: '0.4rem',
            minWidth: '150px',
            zIndex: 20,
            boxShadow: '0 8px 20px rgba(0,0,0,.15)',
          }}
        >

          {FORMATOS.map(formato => (
            <button
              key={formato.id}
              onClick={() => handleExport(formato.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem',
                border: 'none',
                background: 'transparent',
                color: 'var(--cor-texto)',
                cursor: 'pointer',
                borderRadius: '6px',
              }}
            >
              <i className={`bi ${formato.icon}`} />
              {formato.label}
            </button>
          ))}

        </div>
      )}

    </div>
  );
}