import React, { useMemo, useRef, useState, useCallback } from 'react'
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
    
    // Track unique entities to avoid duplicate nodes
    const uniqueRoles = new Set<string>();
    const uniqueNamespaces = new Set<string>();
    
    // Add Cluster node
    nodes.push({ id: 'cluster', name: 'Global Cluster', type: 'cluster', val: 12, color: '#ff3b30' });

    // Process Groups
    groups.forEach(g => {
      const gId = `g-${g.name}`;
      nodes.push({ id: gId, name: g.friendlyName || g.name, type: 'group', val: 6, color: '#af52de' });
      
      (g.resources || []).forEach((r: any) => {
        const roleId = `r-${r.template}`;
        if (!uniqueRoles.has(roleId)) {
          nodes.push({ id: roleId, name: r.template.replace('template-namespaced-resources___', '').replace('template-cluster-resources___', ''), type: 'role', val: 4, color: '#34c759' });
          uniqueRoles.add(roleId);
        }
        links.push({ source: gId, target: roleId, type: 'group-role' });
        
        (r.namespaces || []).forEach((ns: string) => {
          if (ns === 'ALL_NAMESPACES') {
            links.push({ source: roleId, target: 'cluster', type: 'role-ns' });
          } else {
            const nsId = `ns-${ns}`;
            if (!uniqueNamespaces.has(nsId)) {
              nodes.push({ id: nsId, name: ns, type: 'namespace', val: 3, color: '#ff9500' });
              uniqueNamespaces.add(nsId);
            }
            links.push({ source: roleId, target: nsId, type: 'role-ns' });
          }
        });
      });
    });

    // Process Users
    users.forEach(u => {
      const uId = `u-${u.name}`;
      nodes.push({ id: uId, name: u.friendlyName || u.name, type: 'user', val: 5, color: '#007aff' });
      
      // Link user to groups
      if (settings.GROUPS_ENABLED === 'true') {
        (u.groups || []).forEach(gName => {
          links.push({ source: uId, target: `g-${gName}`, type: 'user-group' });
        });
      }
      
      // Link user directly to roles
      (u.resources || []).forEach((r: any) => {
        const roleId = `r-${r.template}`;
        if (!uniqueRoles.has(roleId)) {
          nodes.push({ id: roleId, name: r.template.replace('template-namespaced-resources___', '').replace('template-cluster-resources___', ''), type: 'role', val: 4, color: '#34c759' });
          uniqueRoles.add(roleId);
        }
        links.push({ source: uId, target: roleId, type: 'user-role' });
        
        (r.namespaces || []).forEach((ns: string) => {
          if (ns === 'ALL_NAMESPACES') {
            links.push({ source: roleId, target: 'cluster', type: 'role-ns' });
          } else {
            const nsId = `ns-${ns}`;
            if (!uniqueNamespaces.has(nsId)) {
              nodes.push({ id: nsId, name: ns, type: 'namespace', val: 3, color: '#ff9500' });
              uniqueNamespaces.add(nsId);
            }
            links.push({ source: roleId, target: nsId, type: 'role-ns' });
          }
        });
      });
    });

    return { nodes, links };
  }, [users, groups, settings.GROUPS_ENABLED]);

  // Handle node hover interaction
  const handleNodeHover = useCallback((node: any) => {
    setHighlightNodes(new Set());
    setHighlightLinks(new Set());

    if (node) {
      const newHighlightNodes = new Set([node.id]);
      const newHighlightLinks = new Set();
      
      // Find all connected links and nodes (1 level deep)
      graphData.links.forEach(link => {
        if (link.source.id === node.id || link.source === node.id) {
          newHighlightLinks.add(link);
          newHighlightNodes.add(link.target.id || link.target);
        }
        if (link.target.id === node.id || link.target === node.id) {
          newHighlightLinks.add(link);
          newHighlightNodes.add(link.source.id || link.source);
        }
      });

      setHighlightNodes(newHighlightNodes);
      setHighlightLinks(newHighlightLinks);
    }
    setHoverNode(node);
  }, [graphData]);

  const paintNode = useCallback((node: any, ctx: any, globalScale: any) => {
    const label = node.name;
    const fontSize = 12/globalScale;
    ctx.font = `${fontSize}px Sans-Serif`;
    const textWidth = ctx.measureText(label).width;
    const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2); 

    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    if (hoverNode && !highlightNodes.has(node.id)) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'; // dim others
    }
    
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
    ctx.fillStyle = node.color;
    if (hoverNode && !highlightNodes.has(node.id)) {
        ctx.fillStyle = 'rgba(200, 200, 200, 0.2)';
    }
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = hoverNode && !highlightNodes.has(node.id) ? 'rgba(0,0,0,0.2)' : '#1d1d1f';
    ctx.fillText(label, node.x, node.y + node.val + 4);
  }, [hoverNode, highlightNodes]);

  return (
    <div className="bg-gray-100 min-h-[calc(100vh-48px)] flex flex-col relative">
      {(usersLoading || loadingGroups) && <FullScreenLoader />}
      
      <div className="absolute top-6 left-6 z-10 bg-white/90 backdrop-blur p-4 rounded-xl shadow-lg pointer-events-none">
        <h2 className="text-lg font-black text-gray-800 tracking-tight mb-3">RBAC Legend</h2>
        <div className="flex flex-col gap-2 text-xs font-bold uppercase tracking-widest">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#007aff]"></div><span>Users</span></div>
            {settings.GROUPS_ENABLED === 'true' && <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#af52de]"></div><span>Groups</span></div>}
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#34c759]"></div><span>Roles</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#ff9500]"></div><span>Namespaces</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#ff3b30]"></div><span>Cluster (Global)</span></div>
        </div>
        <p className="mt-4 text-[10px] text-gray-500 font-medium normal-case">Scroll to zoom. Drag to pan. Hover nodes to highlight relationships.</p>
      </div>

      <div className="flex-grow w-full h-full overflow-hidden" style={{ cursor: 'grab' }}>
        {graphData.nodes.length > 0 && (
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            nodeCanvasObject={paintNode}
            nodePointerAreaPaint={(node, color, ctx) => {
              ctx.fillStyle = color;
              const bckgDimensions = [node.val, node.val].map(n => n + 10);
              ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);
            }}
            onNodeHover={handleNodeHover}
            linkColor={(link: any) => highlightLinks.has(link) ? '#000000' : 'rgba(0,0,0,0.1)'}
            linkWidth={(link: any) => highlightLinks.has(link) ? 2 : 1}
            linkDirectionalArrowLength={3}
            linkDirectionalArrowRelPos={1}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
            cooldownTicks={100}
            onEngineStop={() => graphRef.current?.zoomToFit(400, 50)}
          />
        )}
      </div>
    </div>
  )
}
