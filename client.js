import * as THREE from "three";

const socket = io();
const $ = id => document.getElementById(id);
const menu = $("menu"), hud = $("hud"), mobileControls = $("mobileControls");
const errorBox = $("error");
let myId = null, roomCode = null, roomState = null, myPlayer = null;
let scene, camera, renderer, clock, lava, lavaMat, playerMeshes = new Map(), platforms = [];
let jumpVelocity = 0, onGround = false, moveX = 0, moveZ = 0, lastMoveSend = 0;
const keys = new Set(), touchDirs = new Set();
const arenaRadius = 14;
const colors = {};
const isMobile = matchMedia("(pointer: coarse)").matches || /Android|iPhone|iPad/i.test(navigator.userAgent);

init3D();
$("createRoom").onclick = () => {
  errorBox.textContent = "";
  socket.emit("room:create", { name: getName() }, result => {
    if (!result?.ok) return errorBox.textContent = result?.error || "Não foi possível criar a sala.";
    enterGame(result);
  });
};
$("joinRoom").onclick = () => {
  errorBox.textContent = "";
  socket.emit("room:join", { code: $("roomCode").value, name: getName() }, result => {
    if (!result?.ok) return errorBox.textContent = result?.error || "Não foi possível entrar.";
    enterGame(result);
  });
};
$("roomCode").addEventListener("input", e => e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,5));
$("copyCode").onclick = async () => {
  try { await navigator.clipboard.writeText(roomCode); toast("Código copiado: " + roomCode); }
  catch { toast("Código da sala: " + roomCode); }
};
function getName(){return $("playerName").value.trim().slice(0,16) || "Jogador";}
function enterGame(result){
  myId = result.id; roomCode = result.code;
  menu.classList.add("hidden"); hud.classList.remove("hidden");
  mobileControls.classList.toggle("hidden", !isMobile);
  $("roomCodeHud").textContent = roomCode;
  toast("Sala criada! Envie o código para seus amigos.");
}
function toast(text){const el=$("toast");el.textContent=text;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2300)}

socket.on("room:update", room => {
  roomState = room;
  $("count").textContent = room.players.length;
  $("timer").textContent = room.timeLeft + "s";
  $("roomCodeHud").textContent = room.code;
  const status = room.state === "waiting" ? `A rodada começa em ${room.timeLeft}s` :
    room.state === "playing" ? "A LAVA ESTÁ SUBINDO!" : `🏆 ${room.winner} venceu!`;
  $("status").textContent = status;
  $("leaderboard").innerHTML = "";
  room.players.forEach(p => {
    if (p.id === myId) myPlayer = p;
    if (!colors[p.id]) colors[p.id] = p.color;
    const chip = document.createElement("span");
    chip.className = "player-chip" + (!p.alive ? " dead" : "");
    chip.textContent = (p.id === myId ? "Você: " : "") + p.name;
    $("leaderboard").appendChild(chip);
    ensurePlayer(p);
    const mesh = playerMeshes.get(p.id);
    mesh.position.set(p.x, p.y, p.z);
    mesh.visible = p.alive || room.state !== "playing";
  });
  for (const [id, mesh] of playerMeshes) {
    if (!room.players.some(p => p.id === id)) { scene.remove(mesh); playerMeshes.delete(id); }
  }
  lava.position.y = room.lavaY;
  if (room.state !== "playing") lavaMat.emissiveIntensity = 1.2;
});
socket.on("player:moved", p => {
  const mesh = playerMeshes.get(p.id);
  if (mesh) mesh.position.set(p.x,p.y,p.z);
});
socket.on("connect", () => {});
socket.on("disconnect", () => toast("Conexão perdida. Tentando reconectar..."));

function init3D(){
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x17172e);
  scene.fog = new THREE.Fog(0x17172e, 25, 65);
  camera = new THREE.PerspectiveCamera(55, innerWidth/innerHeight, .1, 150);
  camera.position.set(0, 17, 23);
  camera.lookAt(0, 2, 0);
  renderer = new THREE.WebGLRenderer({antialias:true, powerPreference:"high-performance"});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.setSize(innerWidth,innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  $("game").appendChild(renderer.domElement);
  clock = new THREE.Clock();

  scene.add(new THREE.HemisphereLight(0x9abaff,0x54243b,2.1));
  const key = new THREE.DirectionalLight(0xffd4a4,3.0);
  key.position.set(-8,18,10); key.castShadow=true; scene.add(key);
  const fill = new THREE.PointLight(0xff512b,40,35); fill.position.set(0,0,0); scene.add(fill);

  const floor = new THREE.Mesh(new THREE.CylinderGeometry(15,15,.8,48), new THREE.MeshStandardMaterial({color:0x292a45,roughness:.82}));
  floor.position.y=-3; floor.receiveShadow=true; floor.castShadow=true; scene.add(floor);
  const edge = new THREE.Mesh(new THREE.TorusGeometry(14.7,.18,8,64),new THREE.MeshStandardMaterial({color:0x8e82ff,emissive:0x4130a8,emissiveIntensity:1.2}));
  edge.rotation.x=Math.PI/2;edge.position.y=-2.55;scene.add(edge);

  const platformData = [
    [-8,1,-6,4,0.7,4],[-2,2,-8,3,0.7,3],[5,3,-7,4,0.7,3],
    [9,1,-1,3,0.7,4],[5,4,4,4,0.7,4],[-1,2,7,4,0.7,3],
    [-7,4,5,3,0.7,4],[-10,2,0,3,0.7,3],[1,5,0,3,0.7,3],
    [-3,6,-3,2.8,0.7,2.8],[8,6,7,2.8,0.7,2.8]
  ];
  platformData.forEach((d,i)=>{
    const [x,y,z,w,h,dep]=d;
    const mat=new THREE.MeshStandardMaterial({color:i%3===0?0x5d5a9c:i%3===1?0x3e6484:0x6b4f85,roughness:.65,emissive:0x16172d});
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,dep),mat);
    m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);platforms.push({mesh:m,w,h,dep});
    const top=new THREE.Mesh(new THREE.BoxGeometry(w*.94,.06,dep*.94),new THREE.MeshStandardMaterial({color:0x9bdcff,emissive:0x345a8a,emissiveIntensity:.7}));
    top.position.set(x,y+h/2+.03,z);scene.add(top);
  });
  // Decorative floating rocks
  for(let i=0;i<26;i++){
    const a=i/26*Math.PI*2, r=17+Math.random()*5;
    const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.25+Math.random()*.5,0),new THREE.MeshStandardMaterial({color:i%2?0x44365f:0x292f53,roughness:1}));
    rock.position.set(Math.cos(a)*r,Math.random()*9-2,Math.sin(a)*r);rock.rotation.set(Math.random()*3,Math.random()*3,Math.random()*3);scene.add(rock);
  }
  lavaMat=new THREE.MeshStandardMaterial({color:0xff4b19,emissive:0xff3510,emissiveIntensity:1.2,roughness:.32,metalness:.05});
  lava=new THREE.Mesh(new THREE.CylinderGeometry(15.2,15.2,.35,48),lavaMat);lava.position.y=-2.5;scene.add(lava);
  const glow=new THREE.PointLight(0xff4318,22,28);glow.position.set(0,-1,0);scene.add(glow);

  window.addEventListener("resize",()=>{
    camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);
  });
  window.addEventListener("keydown",e=>{if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code))e.preventDefault();keys.add(e.code);if(e.code==="Space")jump();});
  window.addEventListener("keyup",e=>keys.delete(e.code));
  $("jumpBtn").addEventListener("pointerdown",e=>{e.preventDefault();jump()});
  document.querySelectorAll("[data-dir]").forEach(btn=>{
    const dir=btn.dataset.dir;
    btn.addEventListener("pointerdown",e=>{e.preventDefault();touchDirs.add(dir);btn.setPointerCapture?.(e.pointerId)});
    const release=()=>touchDirs.delete(dir);
    btn.addEventListener("pointerup",release);btn.addEventListener("pointercancel",release);btn.addEventListener("lostpointercapture",release);
  });
  animate();
}
function ensurePlayer(p){
  if(playerMeshes.has(p.id))return;
  const group=new THREE.Group();
  const mat=new THREE.MeshStandardMaterial({color:p.color,roughness:.55});
  const dark=new THREE.MeshStandardMaterial({color:0x20243a,roughness:.8});
  const torso=new THREE.Mesh(new THREE.BoxGeometry(.85,.9,.45),mat);torso.position.y=1.25;torso.castShadow=true;group.add(torso);
  const head=new THREE.Mesh(new THREE.BoxGeometry(.62,.62,.62),new THREE.MeshStandardMaterial({color:0xffd1a8,roughness:.8}));head.position.y=2.05;head.castShadow=true;group.add(head);
  const hair=new THREE.Mesh(new THREE.BoxGeometry(.66,.18,.66),dark);hair.position.y=2.39;group.add(hair);
  for(const x of [-.23,.23]){
    const leg=new THREE.Mesh(new THREE.BoxGeometry(.28,.65,.32),dark);leg.position.set(x,.47,0);leg.castShadow=true;group.add(leg);
    const arm=new THREE.Mesh(new THREE.BoxGeometry(.25,.72,.3),mat);arm.position.set(x*2,1.3,0);arm.castShadow=true;group.add(arm);
  }
  scene.add(group);playerMeshes.set(p.id,group);
}
function jump(){if(!roomState||roomState.state!=="playing"||!myPlayer?.alive||!onGround)return;jumpVelocity=9.5;onGround=false}
function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),.04), t=clock.elapsedTime;
  lavaMat.emissiveIntensity=1.0+Math.sin(t*3)*.25;
  lava.scale.x=1+Math.sin(t*1.7)*.006;
  if(roomState?.state==="playing"&&myPlayer?.alive){
    let dx=0,dz=0;
    if(keys.has("KeyA")||keys.has("ArrowLeft")||touchDirs.has("left"))dx--;
    if(keys.has("KeyD")||keys.has("ArrowRight")||touchDirs.has("right"))dx++;
    if(keys.has("KeyW")||keys.has("ArrowUp")||touchDirs.has("up"))dz--;
    if(keys.has("KeyS")||keys.has("ArrowDown")||touchDirs.has("down"))dz++;
    const len=Math.hypot(dx,dz)||1;dx/=len;dz/=len;
    const mesh=playerMeshes.get(myId);
    if(mesh){
      const speed=7.2;
      let nx=mesh.position.x+dx*speed*dt, nz=mesh.position.z+dz*speed*dt;
      nx=Math.max(-13.5,Math.min(13.5,nx));nz=Math.max(-13.5,Math.min(13.5,nz));
      const prevY=mesh.position.y;
      jumpVelocity-=22*dt;
      let ny=prevY+jumpVelocity*dt;
      let landed=false;
      if(jumpVelocity<=0){
        for(const p of platforms){
          const pos=p.mesh.position;
          if(nx>pos.x-p.w/2-.25&&nx<pos.x+p.w/2+.25&&nz>pos.z-p.dep/2-.25&&nz<pos.z+p.dep/2+.25){
            const top=pos.y+p.h/2;
            if(prevY>=top-.1&&ny<=top+.08){ny=top;jumpVelocity=0;landed=true;break;}
          }
        }
        if(!landed&&ny<=-2.25){ny=-2.25;jumpVelocity=0;landed=true;}
      }
      onGround=landed;
      mesh.position.set(nx,ny,nz);
      myPlayer.x=nx;myPlayer.y=ny;myPlayer.z=nz;
      if(dx||dz)mesh.rotation.y=Math.atan2(dx,dz);
      if(performance.now()-lastMoveSend>55){socket.emit("player:move",{x:nx,y:ny,z:nz});lastMoveSend=performance.now();}
    }
  }
  // Soft camera follow on local player
  const local=playerMeshes.get(myId);
  if(local&&roomState){const target=new THREE.Vector3(local.position.x*.35,17+local.position.y*.15,23+local.position.z*.25);camera.position.lerp(target,.035);camera.lookAt(local.position.x*.3,2,local.position.z*.3);}
  renderer.render(scene,camera);
}
