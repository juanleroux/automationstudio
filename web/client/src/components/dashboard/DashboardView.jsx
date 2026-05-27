import React, { useMemo, useRef, useState, useLayoutEffect } from 'react';
import { Layers, Database, Map, Cpu, AlertTriangle, Clock } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import NoProjectOpen from '../shared/NoProjectOpen';

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
    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
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

function AreaRow({ node, depth }) {
  return (
    <>
      <div className="flex items-center justify-between" style={{ padding: `5px 16px 5px ${16 + depth * 14}px` }}>
        {depth > 0 && (
          <span style={{ color: 'var(--border)', marginRight: 6, fontSize: 10, flexShrink: 0 }}>└</span>
        )}
        <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.name}
        </span>
        <span className="badge" style={{ marginLeft: 8, flexShrink: 0 }}>{node.instanceCount}</span>
      </div>
      {node.children.map(child => (
        <AreaRow key={child.id} node={child} depth={depth + 1} />
      ))}
    </>
  );
}

function buildAreaTree(flatAreas, allInstances, parentId = null) {
  return flatAreas
    .filter(a => (a.parentId ?? null) === parentId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(a => ({
      ...a,
      instanceCount: allInstances.filter(i => i.areaId === a.id).length,
      children: buildAreaTree(flatAreas, allInstances, a.id),
    }));
}

export default function DashboardView() {
  const { project } = useProject();
  const templatesRef = useRef(null);
  const [areasCardHeight, setAreasCardHeight] = useState(null);

  useLayoutEffect(() => {
    const el = templatesRef.current;
    if (!el) return;
    const measure = () => setAreasCardHeight(el.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
      }))
      .sort((a, b) => b.instances - a.instances);

    const areaTree = buildAreaTree(areas, allInstances, null);

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
      areaTree,
      flagged,
      recent: recentItems.slice(0, 10),
    };
  }, [project]);

  if (!project) {
    return <NoProjectOpen />;
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

      {/* Two-column layout */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>

        {/* Left: Templates — natural height, measured for Areas */}
        <div ref={templatesRef} style={{ flex: '2 1 0', minWidth: 0 }}>
          <Card style={{ display: 'flex', flexDirection: 'column' }}>
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
        </div>

        {/* Right: Areas + optional Flagged */}
        <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card style={{
            display: 'flex',
            flexDirection: 'column',
            height: areasCardHeight ?? 'auto',
            overflow: 'hidden',
          }}>
            <SectionHeader>Areas</SectionHeader>
            {m.areaTree.length === 0 && m.unassigned === 0 ? (
              <div style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: 13 }}>No areas defined</div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
                {/* Unassigned always first */}
                {m.unassigned > 0 && (
                  <div className="flex items-center justify-between" style={{ padding: '5px 16px' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>Unassigned</span>
                    <span className="badge">{m.unassigned}</span>
                  </div>
                )}
                {m.areaTree.map(node => (
                  <AreaRow key={node.id} node={node} depth={0} />
                ))}
              </div>
            )}
          </Card>

          {/* Flagged instances */}
          {m.flagged.length > 0 && (
            <Card>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
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

      {/* Recent activity — full width */}
      {m.recent.length > 0 && (
        <Card>
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
