import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { useUsers } from '../hooks/useUsers'
import { httpRequests } from '../services/httpRequests'
import { FullScreenLoader } from '../components/Loader'
import { useSettings } from '../hooks/useSettings'

export default function Visualizer() {
  const { users, loading: usersLoading } = useUsers()
  const { settings } = useSettings()
  const [groups, setGroups] = useState<any[]>([])
  const [loadingGroups, setLoadingGroups] = useState(false)
  const graphRef = useRef<any>();
  const [visibleTypes, setVisibleTypes] = useState(() => new Set(['user', 'group', 'role', 'namespace', 'cluster']))

  // Highlight states
  const [hoverNode, setHoverNode] = useState<any>(null);
  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [highlightLinks, setHighlightLinks] = useState(new Set());

  React.useEffect(() => {
    if (settings.GROUPS_ENABLED !== 'true') return;
    setLoadingGroups(true)
    httpRequests.groupList().then(res => {
      setGroups(res.data || [])
      setLoadingGroups(false)
    }).catch(err => {
      console.error(err)
      setLoadingGroups(false)
    })
  }, [settings.GROUPS_ENABLED])

  const graphData = useMemo(() => {
    const nodes: any[] = [];
    const links: any[] = [];

    const uniqueRoles = new Set<string>();
    const uniqueNamespaces = new Set<string>();

    nodes.push({ id: 'cluster', name: 'GLOBAL CLUSTER', type: 'cluster', val: 18, color: '#ff3b30' });

    groups.forEach(g => {
      const gId = `g-${g.name}`;
      nodes.push({ id: gId, name: g.friendlyName || g.name, type: 'group', val: 9, color: '#af52de' });

      (g.resources || []).forEach((r: any) => {
        const roleId = `r-${r.template}`;
        if (!uniqueRoles.has(roleId)) {
          nodes.push({ id: roleId, name: r.template.replace('template-namespaced-resources___', '').replace('template-cluster-resources___', ''), type: 'role', val: 6, color: '#34c759' });
          uniqueRoles.add(roleId);
        }
        links.push({ source: gId, target: roleId, type: 'group-role' });

        (r.namespaces || []).forEach((ns: string) => {
          if (ns === 'ALL_NAMESPACES') {
            links.push({ source: roleId, target: 'cluster', type: 'role-cluster' });
          } else {
            const nsId = `ns-${ns}`;
            if (!uniqueNamespaces.has(nsId)) {
              nodes.push({ id: nsId, name: ns, type: 'namespace', val: 5, color: '#ff9500' });
              uniqueNamespaces.add(nsId);
            }
            links.push({ source: roleId, target: nsId, type: 'role-ns' });
          }
        });
      });
    });

    users.forEach(u => {
      const uId = `u-${u.name}`;
      nodes.push({ id: uId, name: u.friendlyName || u.name, type: 'user', val: 7, color: '#007aff' });

      if (settings.GROUPS_ENABLED === 'true') {
        (u.groups || []).forEach(gName => {
          links.push({ source: uId, target: `g-${gName}`, type: 'user-group' });
        });
      }

      (u.resources || []).forEach((r: any) => {
        const roleId = `r-${r.template}`;
        if (!uniqueRoles.has(roleId)) {
          nodes.push({ id: roleId, name: r.template.replace('template-namespaced-resources___', '').replace('template-cluster-resources___', ''), type: 'role', val: 6, color: '#34c759' });
          uniqueRoles.add(roleId);
        }
        links.push({ source: uId, target: roleId, type: 'user-role' });

        (r.namespaces || []).forEach((ns: string) => {
          if (ns === 'ALL_NAMESPACES') {
            links.push({ source: roleId, target: 'cluster', type: 'role-cluster' });
          } else {
            const nsId = `ns-${ns}`;
            if (!uniqueNamespaces.has(nsId)) {
              nodes.push({ id: nsId, name: ns, type: 'namespace', val: 5, color: '#ff9500' });
              uniqueNamespaces.add(nsId);
            }
            links.push({ source: roleId, target: nsId, type: 'role-ns' });
          }
        });
      });
    });

    const seenLinks = new Set();
    const uniqueLinks = links.filter(link => {
      const key = `${link.source}-${link.target}`;
      if (seenLinks.has(key)) return false;
      seenLinks.add(key);
      return true;
    });

    return { nodes, links: uniqueLinks };
  }, [users, groups, settings.GROUPS_ENABLED]);

  const filteredGraphData = useMemo(() => {
    const filteredNodes = graphData.nodes.filter(n => visibleTypes.has(n.type));
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredLinks = graphData.links
      .filter(l => {
        const sId = (l.source as any)?.id ?? l.source;
        const tId = (l.target as any)?.id ?? l.target;
        return filteredNodeIds.has(sId) && filteredNodeIds.has(tId);
      })
      .map(l => ({
        source: (l.source as any)?.id ?? l.source,
        target: (l.target as any)?.id ?? l.target,
        type: l.type,
      }));
    return { nodes: filteredNodes.map(n => ({ ...n })), links: filteredLinks };
  }, [graphData, visibleTypes]);

  // Reset hover state when filter changes
  useEffect(() => {
    setHoverNode(null);
    setHighlightNodes(new Set());
    setHighlightLinks(new Set());
  }, [filteredGraphData]);

  const linksMap = useMemo(() => {
    const map = new Map<string, any>();
    filteredGraphData.links.forEach(l => {
      const sId = (l.source as any)?.id ?? l.source;
      const tId = (l.target as any)?.id ?? l.target;
      map.set(`${sId}->${tId}`, l);
    });
    return map;
  }, [filteredGraphData.links]);

  const handleNodeHover = useCallback((node: any) => {
    const newHighlightNodes = new Set();
    const newHighlightLinks = new Set();

    if (node) {
      newHighlightNodes.add(node.id);

      const addLink = (sourceId: string, targetId: string) => {
        const link = linksMap.get(`${sourceId}->${targetId}`);
        if (link) {
          newHighlightLinks.add(link);
          newHighlightNodes.add(sourceId);
          newHighlightNodes.add(targetId);
          return true;
        }
        return false;
      };

      if (node.type === 'user') {
        const u = users.find(user => `u-${user.name}` === node.id);
        if (u) {
          (u.resources || []).forEach(r => {
            const roleId = `r-${r.template}`;
            if (addLink(node.id, roleId)) {
              (r.namespaces || []).forEach(ns => {
                const nsTargetId = ns === 'ALL_NAMESPACES' ? 'cluster' : `ns-${ns}`;
                addLink(roleId, nsTargetId);
              });
            }
          });

          (u.groups || []).forEach(gName => {
            const gId = `g-${gName}`;
            if (addLink(node.id, gId)) {
              const g = groups.find(group => group.name === gName);
              if (g) {
                (g.resources || []).forEach(r => {
                  const roleId = `r-${r.template}`;
                  if (addLink(gId, roleId)) {
                    (r.namespaces || []).forEach(ns => {
                      const nsTargetId = ns === 'ALL_NAMESPACES' ? 'cluster' : `ns-${ns}`;
                      addLink(roleId, nsTargetId);
                    });
                  }
                });
              }
            }
          });
        }
      } else if (node.type === 'group') {
        const g = groups.find(group => `g-${group.name}` === node.id);
        if (g) {
          (g.resources || []).forEach(r => {
            const roleId = `r-${r.template}`;
            if (addLink(node.id, roleId)) {
              (r.namespaces || []).forEach(ns => {
                const nsTargetId = ns === 'ALL_NAMESPACES' ? 'cluster' : `ns-${ns}`;
                addLink(roleId, nsTargetId);
              });
            }
          });
          users.forEach(u => {
            if ((u.groups || []).includes(g.name)) {
              addLink(`u-${u.name}`, node.id);
            }
          });
        }
      } else if (node.type === 'role') {
        filteredGraphData.links.forEach(l => {
          const sId = (l.source as any)?.id ?? l.source;
          const tId = (l.target as any)?.id ?? l.target;
          if (sId === node.id || tId === node.id) {
            newHighlightLinks.add(l);
            newHighlightNodes.add(sId);
            newHighlightNodes.add(tId);
          }
        });
      } else if (node.type === 'namespace' || node.type === 'cluster') {
        filteredGraphData.links.forEach(l => {
          const sId = (l.source as any)?.id ?? l.source;
          const tId = (l.target as any)?.id ?? l.target;
          if (tId === node.id) {
            newHighlightLinks.add(l);
            newHighlightNodes.add(sId);
            filteredGraphData.links.forEach(l2 => {
              const sId2 = (l2.source as any)?.id ?? l2.source;
              const tId2 = (l2.target as any)?.id ?? l2.target;
              if (tId2 === sId) {
                let isRelevant = false;
                if (sId2.startsWith('u-')) {
                  const u = users.find(user => `u-${user.name}` === sId2);
                  const resource = u?.resources?.find(r => `r-${r.template}` === sId);
                  const targetNs = node.type === 'cluster' ? 'ALL_NAMESPACES' : node.name;
                  if (resource?.namespaces?.includes(targetNs)) isRelevant = true;

                  if (!isRelevant && u?.groups) {
                    u.groups.forEach(gn => {
                      const g = groups.find(group => group.name === gn);
                      const gr = g?.resources?.find(r => `r-${r.template}` === sId);
                      if (gr?.namespaces?.includes(targetNs)) isRelevant = true;
                    });
                  }
                } else if (sId2.startsWith('g-')) {
                  const g = groups.find(group => `g-${group.name}` === sId2);
                  const resource = g?.resources?.find(r => `r-${r.template}` === sId);
                  const targetNs = node.type === 'cluster' ? 'ALL_NAMESPACES' : node.name;
                  if (resource?.namespaces?.includes(targetNs)) isRelevant = true;
                }

                if (isRelevant) {
                  newHighlightLinks.add(l2);
                  newHighlightNodes.add(sId2);
                }
              }
            });
          }
        });
      }
    }

    setHighlightNodes(newHighlightNodes);
    setHighlightLinks(newHighlightLinks);
    setHoverNode(node);
  }, [filteredGraphData, users, groups, linksMap]);

  const paintNode = useCallback((node: any, ctx: any, globalScale: any) => {
    const label = node.name;
    const fontSize = 13/globalScale;
    ctx.font = `${node.type === 'cluster' ? 'bold' : 'normal'} ${fontSize}px Sans-Serif`;

    ctx.beginPath();
    ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);

    if (hoverNode && !highlightNodes.has(node.id)) {
      ctx.fillStyle = 'rgba(200, 200, 200, 0.15)';
    } else {
      ctx.fillStyle = node.color;
    }
    ctx.fill();

    if (highlightNodes.has(node.id)) {
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2/globalScale;
      ctx.stroke();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = hoverNode && !highlightNodes.has(node.id) ? 'rgba(0,0,0,0.1)' : '#1d1d1f';
    ctx.fillText(label, node.x, node.y + node.val + 5);
  }, [hoverNode, highlightNodes]);

  const toggleType = (type: string) => {
    setVisibleTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  return (
    <div className="bg-gray-100 min-h-[calc(100vh-48px)] flex flex-col relative">
      {(usersLoading || loadingGroups) && <FullScreenLoader />}

      <div className="absolute top-6 left-6 z-10 bg-white/90 backdrop-blur p-5 rounded-2xl shadow-2xl border border-white/50 max-w-[250px]">
        <h2 className="text-xl font-black text-gray-800 tracking-tight mb-1 flex items-center gap-2">
          <div className="w-2 h-5 bg-teal-500 rounded-full"></div>
          RBAC Map Legend
        </h2>
        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-4">Click to toggle visibility</p>
        <div className="flex flex-col gap-3 text-[10px] font-black uppercase tracking-widest text-gray-600">
          <button onClick={() => toggleType('user')} className={`flex items-center gap-3 text-left transition-opacity cursor-pointer ${visibleTypes.has('user') ? '' : 'opacity-30'}`}>
            <div className="w-4 h-4 rounded-full bg-[#007aff] shadow-sm flex-shrink-0"></div>
            <span>Users</span>
          </button>
          {settings.GROUPS_ENABLED === 'true' && (
            <button onClick={() => toggleType('group')} className={`flex items-center gap-3 text-left transition-opacity cursor-pointer ${visibleTypes.has('group') ? '' : 'opacity-30'}`}>
              <div className="w-4 h-4 rounded-full bg-[#af52de] shadow-sm flex-shrink-0"></div>
              <span>Groups</span>
            </button>
          )}
          <button onClick={() => toggleType('role')} className={`flex items-center gap-3 text-left transition-opacity cursor-pointer ${visibleTypes.has('role') ? '' : 'opacity-30'}`}>
            <div className="w-4 h-4 rounded-full bg-[#34c759] shadow-sm flex-shrink-0"></div>
            <span>Role Templates</span>
          </button>
          <button onClick={() => toggleType('namespace')} className={`flex items-center gap-3 text-left transition-opacity cursor-pointer ${visibleTypes.has('namespace') ? '' : 'opacity-30'}`}>
            <div className="w-4 h-4 rounded-full bg-[#ff9500] shadow-sm flex-shrink-0"></div>
            <span>Namespaces</span>
          </button>
          <button onClick={() => toggleType('cluster')} className={`flex items-center gap-3 text-left transition-opacity cursor-pointer ${visibleTypes.has('cluster') ? '' : 'opacity-30'}`}>
            <div className="w-6 h-6 rounded-full bg-[#ff3b30] shadow-md border-2 border-white flex-shrink-0"></div>
            <span className="text-red-600">Global Cluster</span>
          </button>
        </div>
        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-[10px] text-gray-400 font-medium normal-case leading-relaxed">
            Hover over a node to reveal its <strong>entire permission chain</strong> from identity to target resources.
          </p>
        </div>
      </div>

      <div className="flex-grow w-full h-full overflow-hidden" style={{ cursor: 'grab' }}>
        {filteredGraphData.nodes.length > 0 && (
          <ForceGraph2D
            ref={graphRef}
            graphData={filteredGraphData}
            nodeCanvasObject={paintNode}
            nodePointerAreaPaint={(node, color, ctx) => {
              ctx.fillStyle = color;
              const bckgDimensions = [node.val * 2, node.val * 2];
              ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);
            }}
            onNodeHover={handleNodeHover}
            linkColor={(link: any) => {
              if (highlightLinks.has(link)) return '#000000';
              if (link.type === 'role-cluster') return 'rgba(255, 59, 48, 0.1)';
              return 'rgba(0,0,0,0.06)';
            }}
            linkWidth={(link: any) => highlightLinks.has(link) ? 2.5 : 1}
            linkDirectionalArrowLength={(link: any) => highlightLinks.has(link) ? 4 : 2}
            linkDirectionalArrowRelPos={1}
            d3AlphaDecay={0.01}
            d3VelocityDecay={0.3}
            cooldownTicks={100}
            onEngineStop={() => {
              if (graphRef.current) graphRef.current.zoomToFit(400, 100);
            }}
          />
        )}
      </div>
    </div>
  )
}
