#!/usr/bin/env python3
"""Offline, narrowly scoped glTF 2 skin/animation and OBJ -> QwakeTF MDL converter.
Requires numpy; no browser dependency. Inputs must be the pinned Quaternius files.
Usage: python tools/convert-models.py /path/to/asset-input
MDL quantizes positions to 8 bits per axis across selected clips; no textures needed.
"""
import base64, hashlib, json, pathlib, struct, sys
import numpy as np
ROOT=pathlib.Path(__file__).resolve().parents[1]
SRC=pathlib.Path(sys.argv[1])
OUT=ROOT/'assets/models';OUT.mkdir(parents=True,exist_ok=True)

def mdl(name, frames, triangles, colors, material_ids, clips):
    arr=np.asarray([f[1] for f in frames],dtype=float)
    lo=arr.min(axis=(0,1));hi=arr.max(axis=(0,1));scale=np.maximum((hi-lo)/255,1e-5)
    n=len(arr[0]);nt=len(triangles);nf=len(frames)
    header=struct.pack('<4si3f3ff3f8if',b'IDPO',6,*scale,*lo,float(np.max(np.linalg.norm(arr,axis=2))),0,0,0,1,256,1,n,nt,nf,0,0,1.)
    data=bytearray(header);data+=struct.pack('<i',0)+bytes(range(256))
    for m in material_ids:data+=struct.pack('<iii',0,int(m),0)
    for tri in triangles:data+=struct.pack('<iiii',1,*map(int,tri))
    for (label,_),verts in zip(frames,arr):
        q=np.rint((verts-lo)/scale).clip(0,255).astype(np.uint8)
        data+=struct.pack('<i',0)+bytes([0,0,0,0,255,255,255,0])+label.encode()[:15].ljust(16,b'\0')
        block=np.zeros((n,4),dtype=np.uint8);block[:,:3]=q;data+=block.tobytes()
    palette=np.zeros((256,3),dtype=np.uint8)
    # Source material factors are linear; existing Qwake renderer samples sRGB-like bytes.
    for i,c in enumerate(colors):palette[i]=np.rint(np.clip(c[:3],0,1)**(1/2.2)*255)
    (OUT/(name+'.mdl')).write_bytes(data);(OUT/(name+'.pal')).write_bytes(palette.tobytes())
    meta={'name':name,'vertices':n,'triangles':nt,'frames':nf,'clips':clips,'winding':'CCW','position_quantization_units':scale.tolist()}
    (OUT/(name+'.json')).write_text(json.dumps(meta,indent=2)+'\n');print(name,len(data),'bytes',meta)

def obj(filename,name):
    verts=[];faces=[];mats={};colors=[];material='';uv=[]
    for l in (SRC/(filename+'.mtl')).read_text().splitlines():
        t=l.split()
        if not t:continue
        if t[0]=='newmtl':material=t[1]
        if t[0]=='Kd':mats[material]=len(colors);colors.append(list(map(float,t[1:4])))
    material=0;expanded=[];indices=[];lookup={}
    for l in (SRC/(filename+'.obj')).read_text().splitlines():
        t=l.split()
        if not t:continue
        if t[0]=='v':verts.append(list(map(float,t[1:4])))
        if t[0]=='usemtl':material=mats[t[1]]
        if t[0]=='f':
            face=[]
            for v in t[1:]:
                key=(int(v.split('/')[0])-1,material)
                if key not in lookup:
                    lookup[key]=len(expanded);p=verts[key[0]]
                    # OBJ +X is muzzle-forward, +Y up. Proper-handed Z-up rotation.
                    expanded.append([p[0]*18,-p[2]*18,p[1]*18]);uv.append(material)
                face.append(lookup[key])
            for j in range(1,len(face)-1):indices.append([face[0],face[j],face[j+1]])
    p=np.array(expanded);p[:,0]-=p[:,0].min();p[:,2]-=(p[:,2].max()+p[:,2].min())/2
    mdl(name,[('idle0',p)],indices,colors,uv,{'idle':{'start':0,'count':1,'fps':1,'loop':True}})

def quat(q):
    x,y,z,w=q;return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])

def read_gltf(filename):
    d=json.loads((SRC/filename).read_text());assert d['asset']['version']=='2.0'
    buf=[base64.b64decode(b['uri'].split(',')[1]) for b in d['buffers']]
    dt={5126:'<f4',5123:'<u2',5125:'<u4',5121:'u1'};sizes={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
    def acc(i):
        a=d['accessors'][i];v=d['bufferViews'][a['bufferView']];typ=np.dtype(dt[a['componentType']]);n=sizes[a['type']]
        offset=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',n*typ.itemsize)
        return np.ndarray((a['count'],n),dtype=typ,buffer=buf[v['buffer']],offset=offset,strides=(stride,typ.itemsize)).copy()
    return d,acc

def gltf(filename,name):
    d,acc=read_gltf(filename)
    parents={c:i for i,n in enumerate(d['nodes']) for c in n.get('children',[])}
    materials=[m['pbrMetallicRoughness'].get('baseColorFactor',[1,1,1,1]) for m in d['materials']]
    primitives=[];triangles=[];matids=[];count=0
    for ni,node in enumerate(d['nodes']):
        if 'mesh' not in node:continue
        skin=d['skins'][node['skin']];ibm=acc(skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
        for prim in d['meshes'][node['mesh']]['primitives']:
            at=prim['attributes'];pos=acc(at['POSITION']);n=len(pos);j=acc(at['JOINTS_0']).astype(int);w=acc(at['WEIGHTS_0'])
            assert prim.get('mode',4)==4
            idx=acc(prim['indices']).reshape(-1,3)
            primitives.append((np.c_[pos,np.ones(n)],j,w,skin['joints'],ibm))
            triangles.extend((idx+count).tolist());matids.extend([prim['material']]*n);count+=n
    body_count=count
    if name=='manager':
        # Reuse the already licensed Swat pistol, preserving its hand-local skin
        # coordinates while mapping named joints onto the woman's animated rig.
        source,source_acc=read_gltf('Swat.gltf')
        node=next(n for n in source['nodes'] if n.get('name')=='Pistol')
        skin=source['skins'][node['skin']]
        by_name={n['name']:i for i,n in enumerate(d['nodes']) if 'name' in n}
        joints=[by_name[source['nodes'][i]['name']] for i in skin['joints']]
        ibm=source_acc(skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
        material_offset=len(materials)
        materials.extend(m['pbrMetallicRoughness'].get('baseColorFactor',[1,1,1,1]) for m in source['materials'])
        for prim in source['meshes'][node['mesh']]['primitives']:
            at=prim['attributes'];pos=source_acc(at['POSITION']);n=len(pos)
            assert prim.get('mode',4)==4
            primitives.append((np.c_[pos,np.ones(n)],source_acc(at['JOINTS_0']).astype(int),source_acc(at['WEIGHTS_0']),joints,ibm))
            triangles.extend((source_acc(prim['indices']).reshape(-1,3)+count).tolist())
            matids.extend([material_offset+prim['material']]*n);count+=n
    animations={a['name']:a for a in d['animations']}
    selected=[('idle','Idle_Gun',8,True),('move','Run',8,True),('attack','Gun_Shoot',5,False),('stun','HitRecieve',5,False),('death','Death',9,False)]
    frames=[];clips={}
    for label,source,samples,loop in selected:
        animation=animations[source];channels=[];end=0
        for ch in animation['channels']:
            s=animation['samplers'][ch['sampler']];assert s.get('interpolation','LINEAR') in ('LINEAR','STEP')
            times=acc(s['input']).ravel();values=acc(s['output']);end=max(end,float(times[-1]));channels.append((ch['target'],times,values,s.get('interpolation','LINEAR')))
        clips[label]={'start':len(frames),'count':samples,'fps':samples/max(end,0.1),'loop':loop,'source':source}
        for k in range(samples):
            t=end*k/(samples if loop else samples-1)
            local=[{'translation':n.get('translation',[0,0,0]),'rotation':n.get('rotation',[0,0,0,1]),'scale':n.get('scale',[1,1,1])} for n in d['nodes']]
            for target,times,values,mode in channels:
                i=max(0,min(len(times)-2,int(np.searchsorted(times,t,side='right')-1)));f=float(np.clip((t-times[i])/max(1e-8,times[i+1]-times[i]),0,1))
                a=values[i];b=values[i+1]
                if target['path']=='rotation':
                    a=a.astype(float);b=b.astype(float);dot=float(a@b)
                    if dot<0:b=-b;dot=-dot
                    if dot<.9995:
                        theta=np.arccos(np.clip(dot,-1,1));v=(np.sin((1-f)*theta)*a+np.sin(f*theta)*b)/np.sin(theta)
                    else:v=(1-f)*a+f*b
                    v=v/np.linalg.norm(v)
                else:v=a if mode=='STEP' else (1-f)*a+f*b
                local[target['node']][target['path']]=v
            cache={}
            def matrix(i):
                if i in cache:return cache[i]
                n=d['nodes'][i];tr=local[i]
                m=np.eye(4);m[:3,:3]=quat(tr['rotation'])@np.diag(tr['scale']);m[:3,3]=tr['translation']
                if 'matrix' in n:m=np.array(n['matrix']).reshape(4,4).T
                if i in parents:m=matrix(parents[i])@m
                cache[i]=m;return m
            output=[]
            for pos,j,w,joints,ibm in primitives:
                transforms=np.array([matrix(ji)@ibm[z] for z,ji in enumerate(joints)])
                p=np.zeros((len(pos),4))
                for influence in range(4):p+=np.einsum('nij,nj->ni',transforms[j[:,influence]],pos)*w[:,influence,None]
                # glTF +Z forward, Y up -> Qwake +X forward, Z up; determinant +1.
                output.append(np.c_[p[:,2],p[:,0],p[:,1]])
            frames.append((label+str(k),np.concatenate(output)))
    # Normalise a standing character to the existing 56-unit collision hull.
    idle=frames[0][1][:body_count];scale=56/(idle[:,2].max()-idle[:,2].min());floor=idle[:,2].min()
    center=(idle[:,:2].max(axis=0)+idle[:,:2].min(axis=0))/2
    frames=[(n,(p-np.r_[center,floor])*scale+[0,0,-24]) for n,p in frames]
    mdl(name,frames,triangles,materials,matids,clips)

obj('AssaultRifle_1','rifle');obj('Shotgun_4','cannon')
gltf('Swat.gltf','harvester');gltf('SuitWoman.gltf','manager')
