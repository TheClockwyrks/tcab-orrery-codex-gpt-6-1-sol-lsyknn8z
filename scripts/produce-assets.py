"""One-time asset authoring. Production builds never execute this file."""
import os,json,math,subprocess
ROOT=os.getcwd(); os.makedirs('assets',exist_ok=True)
def run(*a):
 p=subprocess.run(a,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 if p.returncode: raise RuntimeError(str(a)+p.stderr)
def sprite(path,w,h,ops,sheet=False):
 os.makedirs(os.path.dirname('assets/'+path),exist_ok=True)
 cfg={'width':w,'height':h,'background':'#00000000','actions':'/tmp/art-log.json','preview':ROOT+'/assets/'+path}
 json.dump(ops,open('/tmp/art-log.json','w'));json.dump(cfg,open('/tmp/art.json','w'));run('draw-sheet' if 'apertures' in path else 'draw','render','--actions','/tmp/art-log.json','--out',ROOT+'/assets/'+path,'--width',str(w),'--height',str(h))
def circle(x,y,r,c,fill=False):return {'op':'fill_circle' if fill else 'stroke_circle','cx':round(x),'cy':round(y),'r':r,'color':c}
def line(x,y,X,Y,c):return {'op':'line','x0':round(x),'y0':round(y),'x1':round(X),'y1':round(Y),'color':c}
gold='#c5a36cff';light='#f2dca1ff';blue='#69c9d3ff'
names='dust nebula comet nova meteor mercury saturn jupiter mars venus luna sol umbra lumen aether'.split(); colors=['#a3b4c1ff','#bd9ceaff','#91deefff','#ffae70ff','#c79481ff','#c3ddd6ff','#a9ac8fff','#e7b581ff','#e8977aff','#e3d3a0ff','#c9dcedff','#ffe7a0ff','#9a83c9ff','#f5efc3ff','#8ce7d5ff']
for i,(n,c) in enumerate(zip(names,colors)):
 ops=[circle(22,22,20,c),circle(22,22,17,'#142c3cff',True),circle(22,22,15,c)]
 for r in range(13,0,-1):ops.append(circle(21,21,r,c[:7]+format(45+int((14-r)*10),'02x'),True))
 if i in range(6,12):
  for j in range(i-5):
   a=j*math.tau/(i-5)-math.pi/2;ops.append(circle(22+18*math.cos(a),22+18*math.sin(a),1,light,True))
 elif n in ['nova','lumen','aether']:
  for j in range(8):
   a=j*math.pi/4;ops.append(line(22+8*math.cos(a),22+8*math.sin(a),22+18*math.cos(a),22+18*math.sin(a),light))
 elif n=='comet':ops += [line(10,12,30,30,light),line(12,9,33,27,c)]
 elif n=='umbra':ops += [circle(26,18,12,'#142032ff',True)]
 else:
  for j in range(3+i%4):ops.append(circle(15+(j*7)%16,15+(j*11)%16,2,light,True))
 ops += [circle(17,16,3,'#ffffffc0',True)]
 sprite('sprites/motes/'+n+'.png',44,44,ops)
for n in ['plain','triune']:
 ops=[]
 for y in ([8] if n=='plain' else [4,8,12]):ops += [line(0,y,47,y,gold),line(0,y-1,47,y-1,'#68c9d377')]
 sprite('sprites/filaments/'+n+'.png',48,16,ops)
for i,n in enumerate('bind manifold triune sunder wane mirror ascend conjoin eclipse confluence dispersion void'.split()):
 ops=[circle(24,24,21,'#8d7752aa'),circle(24,24,18,'#6b604766')]
 for j in range(3+i%5):
  a=j*math.tau/(3+i%5)-math.pi/2;b=a+(1+i//5)*math.tau/(3+i%5)
  ops += [line(24+14*math.cos(a),24+14*math.sin(a),24+14*math.cos(b),24+14*math.sin(b),gold)]
 ops += [circle(24,24,2+i%4,blue)]
 sprite('sprites/sigils/'+n+'.png',48,48,ops)
ins='grab drop rotate-cw rotate-ccw pivot-cw pivot-ccw extend retract advance recede'.split()
for i,n in enumerate(ins):
 ops=[]
 if i<2:
  ops=[circle(12,12,5,gold, i==0),line(4,5,4,18,gold),line(20,5,20,18,gold)]
 elif i<6:
  ops=[circle(12,12,7,blue if i<4 else gold),line(17,6,20,7,light),line(20,7,20,2 if i%2 else 12,light)]
 else:
  sign=1 if i%2==0 else -1;ops=[line(5,12,19,12,light),line(12+7*sign,12,12+2*sign,7,light),line(12+7*sign,12,12+2*sign,17,light)]
  if i>=8:ops += [line(5,20,19,20,blue)]
 sprite('sprites/instructions/'+n+'.png',24,24,ops)
for n,size in [('hub-arm',40),('hub-piston',40),('gripper-open',32),('gripper-closed',32),('wheel-hub',48),('fixture-mount',48)]:
 c=size//2;ops=[circle(c,c,c-3,gold),circle(c,c,c-5,'#1a2d36ff',True),circle(c,c,c-7,light),circle(c,c,4,blue,True)]
 for j in range(6):
  a=j*math.pi/3;ops.append(circle(c+(c-5)*math.cos(a),c+(c-5)*math.sin(a),1,light,True))
 if 'gripper' in n:
  ops=[line(3,9,20,9,gold),line(3,23,20,23,gold),line(20,9,26,13 if 'closed' in n else 3,light),line(20,23,26,19 if 'closed' in n else 29,light)]
 if n=='hub-piston':ops += [line(5,13,35,13,blue),line(5,27,35,27,blue)]
 sprite('sprites/parts/'+n+'.png',size,size,ops)
for n in ['rise','set']:
 for frame in range(6):
  ops=[circle(24,24,22,blue if n=='rise' else gold),circle(24,24,19,'#436d7caa')]
  for j in range(3):
   a=j*math.tau/3+frame*math.tau/18; b=a+0.9
   ops += [line(24+18*math.cos(a),24+18*math.sin(a),24+10*math.cos(b),24+10*math.sin(b),blue if n=='rise' else light)]
  sprite('sprites/apertures/'+n+'/'+str(frame)+'.png',48,48,ops)
for i,n in enumerate(['place','erase','start','halt','constellation','complete']):
 cfg={'sample_rate':44100,'channels':'stereo','max_duration_ms':1600,'seed':42,'actions':'/tmp/sfx-log.json','preview':'/tmp/sfx.png', 'wav':ROOT+'/assets/audio/'+n+'.wav'}
 os.makedirs('assets/audio',exist_ok=True);json.dump(cfg,open('/tmp/sfx.json','w'))
 run('sfx-synth','--config','/tmp/sfx.json','init')
 for j in range(3 if i>1 else 1):run('sfx-synth','--config','/tmp/sfx.json','add-voice','--name','v'+str(j),'--wave','sine','--freq',str([740,370,220,110,660,523][i]*(1.25**j)),'--gain','-20','--start',str(j*90),'--dur',str(100 if i<2 else 400))

 if n in ['halt','erase']:run('sfx-synth','--config','/tmp/sfx.json','set-pitch','--voice','v0','--slide-to','65' if n=='halt' else '170','--over','300' if n=='halt' else '90')
 run('sfx-synth','--config','/tmp/sfx.json','render')
cfg={'sample_rate':22050,'channels':'stereo','max_duration_ms':32000,'seed':42,'actions':'/tmp/music-log.json','preview':'/tmp/music.png', 'wav':ROOT+'/assets/audio/music.wav','mid':ROOT+'/assets/audio/music.mid'}
json.dump(cfg,open('/tmp/music.json','w'));run('music','--config','/tmp/music.json','init');run('music','--config','/tmp/music.json','set-tempo','--bpm','60');run('music','--config','/tmp/music.json','define-track','--name','glass','--instrument','sine')
for j in range(32):run('music','--config','/tmp/music.json','add-note','--track','glass','--pitch',str([50,57,62,64,69,64,62,57][j%8]),'--t',str(j),'--dur','0.7','--velocity','35')
run('music','--config','/tmp/music.json','render')
for n in ['deliver','fault','complete']:
 os.makedirs('assets/particles',exist_ok=True)
 cfg={'width':200,'height':200,'duration_ms':1400,'fps':30,'seed':42,'actions':'/tmp/particle-log.json','preview':'/tmp/particle.gif', 'system':ROOT+'/assets/particles/'+n+'.json'}
 json.dump(cfg,open('/tmp/particle.json','w'));run('particle-2d','--config','/tmp/particle.json','init');run('particle-2d','--config','/tmp/particle.json','add-emitter','--name','sparks','--shape','point','--x','100','--y','100','--burst','45','--lifetime','1100','--lifetime-spread','250','--speed','65','--speed-spread','30','--cone-angle','180');run('particle-2d','--config','/tmp/particle.json','set-timeline','--loop','false');run('particle-2d','--config','/tmp/particle.json','set-particle','--emitter','sparks','--size-from','3','--size-to','0','--color-gradient',('#ff785e@0,#8c324c@1' if n=='fault' else '#f5da91@0,#69d3e2@1'));run('particle-2d','--config','/tmp/particle.json','render')
