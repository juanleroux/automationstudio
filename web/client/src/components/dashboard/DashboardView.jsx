import React, { useMemo } from 'react';
import { Layers, Database, Map, Cpu, AlertTriangle, Clock } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';

function StatCard({ icon: Icon, label, value, sub, warn }) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '16px 20px',
      flex: '1 1 140px',
      minWidth: 0,
    }}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={15} style={{ color: warn ? '#e55353' : 'var(--accent)', flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 34, fontWeight: 700, color: warn && value > 0 ? '#e55353' : 'var(--text-primary)', lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{sub}</div>
      )}
    </div>
  );
}

function SectionHeader({ children }) {
  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{children}</span>
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  );
}

export default function DashboardView() {
  const { project } = useProject();

  const m = useMemo(() => {
    if (!project) return null;

    const templates = project.templates || [];
    const areas = (project.areas || []).filter(a => !a.isSystem);
    const allInstances = templates.flatMap(t =>
      (t.instances || []).map(i => ({ ...i, templateName: t.name }))
    );

    const flagged = allInstances.filter(i => i.isFlagged);
    const unassigned = allInstances.filter(i => !i.areaId || i.areaId === 0).length;
    const totalAttributes = templates.reduce((s, t) => s + (t.attributes?.length || 0), 0);

    const templateStats = [...templates]
      .map(t => ({
        id: t.id,
        name: t.name,
        instances: t.instances?.length || 0,
        attributes: t.attributes?.length || 0,
        profiles: t.profiles?.length || 0,
        lastModification: t.lastModification,
      }))
      .sort((a, b) => b.instances - a.instances);

    const areaStats = areas.map(a => ({
      ...a,
      count: allInstances.filter(i => i.areaId === a.id).length,
    })).sort((a, b) => b.count - a.count);

    const recentItems = [];
    templates.forEach(t => {
      if (t.lastModification) recentItems.push({ type: 'Template', name: t.name, date: t.lastModification });
      (t.instances || []).forEach(i => {
        if (i.lastModification) recentItems.push({ type: 'Instance', name: i.name, sub: t.name, date: i.lastModification });
      });
    });
    recentItems.sort((a, b) => new Date(b.date) - new Date(a.date));

    return {
      templateCount: templates.length,
      instanceCount: allInstances.length,
      areaCount: areas.length,
      attributeCount: totalAttributes,
      flaggedCount: flagged.length,
      unassigned,
      templateStats,
      areaStats,
      flagged,
      recent: recentItems.slice(0, 10),
    };
  }, [project]);

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-disabled)' }}>
        <div className="text-center">
          <p className="text-lg font-medium" style={{ color: 'var(--text-muted)' }}>No Project Open</p>
          <p className="text-sm mt-1">Create or open a project from the sidebar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto" style={{ padding: 24, background: 'var(--bg-main)' }}>

      {/* Stat cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <StatCard icon={Layers}        label="Templates"  value={m.templateCount} />
        <StatCard icon={Database}      label="Instances"  value={m.instanceCount}
          sub={m.unassigned > 0 ? `${m.unassigned} unassigned` : null} />
        <StatCard icon={Map}           label="Areas"      value={m.areaCount} />
        <StatCard icon={Cpu}           label="Attributes" value={m.attributeCount} />
        <StatCard icon={AlertTriangle} label="Flagged"    value={m.flaggedCount} warn />
      </div>

      {/* Main grid */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* Templates table */}
        <Card style={{ flex: '2 1 400px' }}>
          <SectionHeader>Templates</SectionHeader>
          {m.templateStats.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No templates yet</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th style={{ textAlign: 'right' }}>Instances</th>
                  <th style={{ textAlign: 'right' }}>Attributes</th>
                  <th style={{ textAlign: 'right' }}>Profiles</th>
                </tr>
              </thead>
              <tbody>
                {m.templateStats.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 500 }}>{t.name}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{t.instances}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{t.attributes}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{t.profiles}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* Right column */}
        <div style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Areas */}
          <Card>
            <SectionHeader>Areas</SectionHeader>
            {m.areaStats.length === 0 ? (
              <div style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: 13 }}>No areas defined</div>
            ) : (
              <div style={{ padding: '6px 0' }}>
                {m.areaStats.map(a => (
                  <div key={a.id} className="flex items-center justify-between" style={{ padding: '6px 16px' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{a.name}</span>
                    <span className="badge">{a.count}</span>
                  </div>
                ))}
                {m.unassigned > 0 && (
                  <div className="flex items-center justify-between" style={{ padding: '6px 16px' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>Unassigned</span>
                    <span className="badge">{m.unassigned}</span>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Flagged instances */}
          {m.flagged.length > 0 && (
            <Card>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={13} style={{ color: '#e55353' }} />
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>Flagged Instances</span>
              </div>
              <div style={{ maxHeight: 220, overflowY: 'auto', padding: '6px 0' }}>
                {m.flagged.map((inst, i) => (
                  <div key={i} style={{ padding: '6px 16px' }}>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{inst.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{inst.templateName}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Recent activity */}
      {m.recent.length > 0 && (
        <Card style={{ marginTop: 16 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={13} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>Recent Activity</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', padding: '12px 16px', gap: 8 }}>
            {m.recent.map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                borderRadius: 6, padding: '5px 10px', fontSize: 12,
              }}>
                <span style={{ color: 'var(--accent)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>
                  {item.type}
                </span>
                <span style={{ color: 'var(--text-primary)' }}>{item.name}</span>
                {item.sub && <span style={{ color: 'var(--text-muted)' }}>· {item.sub}</span>}
                <span style={{ color: 'var(--text-disabled)' }}>{new Date(item.date).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
