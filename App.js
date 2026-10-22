import 'react-native-url-polyfill/auto';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Animated, View, Text, TextInput, Pressable, FlatList, Modal, StyleSheet, ActivityIndicator, Alert, StatusBar, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import QRCode from 'react-native-qrcode-svg';

// Publishable key only (safe on-device, protected by RLS). Never put a service-role key here.
const sb = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_KEY, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});
const C = { bg: '#060a18', panel: '#0d1330', card: 'rgba(255,255,255,0.06)', bd: 'rgba(150,170,255,0.2)', tx: '#e9edff', mu: '#8f9acb', a: '#22d3ee', b: '#8b5cf6', ok: '#34d399', er: '#fb7185', wa: '#fbbf24' };
const G = ['#2a1b6e', '#0e5a78'], GA = [C.a, C.b], GX = ['#3a4170', '#262c55'];
const stC = { open: C.ok, closed: C.er, Present: C.ok, Late: C.wa, Absent: C.er };
let notify = () => {};
const hap = (k) => { try { Haptics.notificationAsync(Haptics.NotificationFeedbackType[k === 'ok' ? 'Success' : k === 'wa' ? 'Warning' : 'Error']); } catch (e) {} };
const fmt = (iso) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
const ini = (n) => (n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const loop = (v, a, b, d) => Animated.loop(Animated.sequence([Animated.timing(v, { toValue: b, duration: d, useNativeDriver: true }), Animated.timing(v, { toValue: a, duration: d, useNativeDriver: true })])).start();

/* ---------- tiny animation kit (native driver) ---------- */
function FadeIn({ d = 0, children, style }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(v, { toValue: 1, duration: 380, delay: d, useNativeDriver: true }).start(); }, []);
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]}>{children}</Animated.View>;
}
function Press({ onPress, onLongPress, style, children, s = 0.96 }) {
  const sc = useRef(new Animated.Value(1)).current, to = (x) => Animated.spring(sc, { toValue: x, useNativeDriver: true, speed: 40 }).start();
  return <Pressable onPressIn={() => to(s)} onPressOut={() => to(1)} onPress={onPress} onLongPress={onLongPress}><Animated.View style={[style, { transform: [{ scale: sc }] }]}>{children}</Animated.View></Pressable>;
}
function Btn({ t, onPress, kind = 'p', busy, small, icon }) {
  const inner = busy ? <ActivityIndicator color="#fff" /> : <View style={st.row}>{icon && <Ionicons name={icon} size={16} color="#fff" />}<Text style={st.bt}>{t}</Text></View>;
  return <Press onPress={busy ? undefined : onPress}>{kind === 'p'
    ? <LinearGradient colors={GA} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[st.btn, small && st.sm]}>{inner}</LinearGradient>
    : <View style={[st.btn, small && st.sm, kind === 'd' ? st.dng : st.gh]}>{inner}</View>}</Press>;
}
function Count({ to = 0, style, suffix = '' }) {
  const v = useRef(new Animated.Value(0)).current, [n, setN] = useState(0);
  useEffect(() => { const id = v.addListener(({ value }) => setN(Math.round(value))); Animated.timing(v, { toValue: to, duration: 700, useNativeDriver: false }).start(); return () => v.removeListener(id); }, [to]);
  return <Text style={style}>{n}{suffix}</Text>;
}
function Skel() { const o = useRef(new Animated.Value(0.25)).current; useEffect(() => loop(o, 0.25, 0.7, 700), []); return <Animated.View style={[st.skel, { opacity: o }]} />; }
const Skels = () => <View>{[0, 1, 2].map((i) => <Skel key={i} />)}</View>;
function Toast() {
  const [t, setT] = useState(null), y = useRef(new Animated.Value(-140)).current, ins = useSafeAreaInsets();
  useEffect(() => { notify = (m, k = 'ok') => { setT({ m, k }); Animated.sequence([Animated.spring(y, { toValue: 0, useNativeDriver: true }), Animated.delay(2400), Animated.timing(y, { toValue: -140, duration: 250, useNativeDriver: true })]).start(); }; }, []);
  const col = t ? C[t.k] : C.ok;
  return <Animated.View pointerEvents="none" style={[st.toast, { top: ins.top + 8, borderColor: col, transform: [{ translateY: y }] }]}><Ionicons name={t?.k === 'er' ? 'close-circle' : 'checkmark-circle'} size={20} color={col} /><Text style={[st.tt, { color: col }]}>{t?.m}</Text></Animated.View>;
}
const Badge = ({ s }) => <View style={[st.badge, { borderColor: stC[s] || C.mu }]}><View style={[st.dot, { backgroundColor: stC[s] || C.mu }]} /><Text style={[st.badgeT, { color: stC[s] || C.mu }]}>{s}</Text></View>;
const Field = ({ l, icon, ...p }) => (<View><Text style={st.lb}>{l}</Text><View style={st.fld}>{icon && <Ionicons name={icon} size={18} color={C.mu} />}<TextInput style={st.in} placeholderTextColor={C.mu} autoCapitalize="none" {...p} /></View></View>);
const Empty = ({ icon = 'planet-outline', t }) => <FadeIn style={{ alignItems: 'center', marginTop: 50 }}><Ionicons name={icon} size={52} color={C.b} /><Text style={st.empty}>{t}</Text></FadeIn>;
const Avatar = ({ n, size = 42 }) => <LinearGradient colors={GA} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontWeight: '800', fontSize: size / 2.6 }}>{ini(n)}</Text></LinearGradient>;
function Seg({ opts, cur, set }) {
  const [w, setW] = useState(0), x = useRef(new Animated.Value(0)).current, i = opts.findIndex((o) => o[0] === cur);
  useEffect(() => { Animated.spring(x, { toValue: (i * w) / opts.length, useNativeDriver: true, bounciness: 5 }).start(); }, [i, w]);
  return <View style={st.seg} onLayout={(e) => setW(e.nativeEvent.layout.width)}><Animated.View style={[st.segI, { width: w / opts.length, transform: [{ translateX: x }] }]}><LinearGradient colors={GA} style={{ flex: 1, borderRadius: 12 }} /></Animated.View>
    {opts.map(([k, l]) => <Pressable key={k} style={st.segB} onPress={() => set(k)}><Text style={[st.segT, cur === k && { color: '#fff' }]}>{l}</Text></Pressable>)}</View>;
}

/* ---------- auth ---------- */
function Auth() {
  const [m, setM] = useState('login'), [f, setF] = useState({ role: 'student' }), [busy, setBusy] = useState(false), p = useRef(new Animated.Value(0)).current, ins = useSafeAreaInsets();
  useEffect(() => loop(p, 0, 1, 1800), []);
  const u = (k) => (v) => setF((o) => ({ ...o, [k]: v }));
  async function go() {
    const email = (f.email || '').trim().toLowerCase(), pw = f.pw || '', reg = m === 'reg';
    if (!/^\S+@\S+\.\S+$/.test(email) || pw.length < (reg ? 8 : 1)) return notify('Enter a valid email. Passwords need 8+ characters to register.', 'er');
    if (reg && (!f.name?.trim() || !f.id?.trim())) return notify('Name and ID are required.', 'er');
    setBusy(true);
    const r = reg ? await sb.auth.signUp({ email, password: pw, options: { data: { full_name: f.name.trim(), id_no: f.id.trim(), section: (f.sec || '').trim(), role: f.role } } }) : await sb.auth.signInWithPassword({ email, password: pw });
    setBusy(false);
    if (r.error) { hap('er'); return notify(r.error.message, 'er'); }
    if (reg && !r.data.session) { notify('Account created. Confirm your email, then log in.'); setM('login'); }
  }
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <LinearGradient colors={G} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[st.hero, { paddingTop: ins.top + 36 }]}>
          <Animated.View style={[st.mark, { transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] }) }] }]}><Ionicons name="qr-code" size={44} color={C.a} /></Animated.View>
          <Text style={st.logo}>QR-ATT</Text><Text style={st.heroSub}>Scan in. Count in.</Text>
        </LinearGradient>
        <FadeIn style={[st.card, { margin: 16, marginTop: -26 }]} key={m}>
          <Seg opts={[['login', 'Log in'], ['reg', 'Create account']]} cur={m} set={setM} />
          {m === 'reg' && <>
            <Field l="Full name" icon="person-outline" value={f.name} onChangeText={u('name')} maxLength={60} autoCapitalize="words" />
            <Field l="Student or staff ID" icon="id-card-outline" value={f.id} onChangeText={u('id')} maxLength={20} />
            <Field l="Section or department" icon="school-outline" value={f.sec} onChangeText={u('sec')} maxLength={30} />
            <View style={{ marginTop: 12 }}><Seg opts={[['student', 'Student'], ['teacher', 'Teacher']]} cur={f.role} set={u('role')} /></View>
          </>}
          <Field l="Email" icon="mail-outline" value={f.email} onChangeText={u('email')} keyboardType="email-address" maxLength={80} />
          <Field l="Password" icon="lock-closed-outline" value={f.pw} onChangeText={u('pw')} secureTextEntry maxLength={72} />
          <View style={{ marginTop: 16 }}><Btn t={m === 'login' ? 'Log in' : 'Create account'} busy={busy} onPress={go} /></View>
          {m === 'reg' && <Text style={[st.mu, { marginTop: 10, textAlign: 'center' }]}>The first account created becomes the Administrator.</Text>}
        </FadeIn>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ---------- events ---------- */
function EvCard({ e, i, staff, admin, done, fn }) {
  const s = new Date(e.starts_at), open = e.status === 'open', n = e.attendance?.[0]?.count ?? 0;
  const IB = ({ ic, on, c = C.tx }) => <Press onPress={on} s={0.88} style={st.ib}><Ionicons name={ic} size={19} color={c} /></Press>;
  return (
    <FadeIn d={Math.min(i, 6) * 70} style={[st.pass, !open && { opacity: 0.8 }]}>
      <LinearGradient colors={open ? GA : GX} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={st.stub}>
        <Text style={st.sMon}>{s.toLocaleString([], { month: 'short' })}</Text><Text style={st.sDay}>{s.getDate()}</Text><Text style={st.sMon}>{s.toLocaleString([], { weekday: 'short' })}</Text>
      </LinearGradient>
      <View style={st.tear} />
      <View style={{ flex: 1, padding: 14 }}>
        <View style={[st.row, { justifyContent: 'space-between' }]}><Text style={st.time}>{s.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text><Badge s={e.status} /></View>
        <Text style={st.h3} numberOfLines={2}>{e.name}</Text>
        <View style={[st.row, { marginTop: 2 }]}><Ionicons name="location-outline" size={14} color={C.mu} /><Text style={st.mu} numberOfLines={1}>{e.venue}</Text></View>
        {!!e.description && <Text style={st.desc} numberOfLines={2}>{e.description}</Text>}
        {staff ? <View style={[st.row, { marginTop: 10, justifyContent: 'space-between' }]}>
          <View style={st.row}><Ionicons name="people-outline" size={15} color={C.a} /><Text style={{ color: C.a, fontWeight: '700' }}>{n}</Text></View>
          <View style={st.row}><IB ic="qr-code" on={() => fn.qr(e)} c={C.a} /><IB ic="create-outline" on={() => fn.edit(e)} /><IB ic={open ? 'lock-closed-outline' : 'lock-open-outline'} on={() => fn.toggle(e)} />{admin && <IB ic="trash-outline" on={() => fn.del(e)} c={C.er} />}</View></View>
          : <View style={[st.row, { marginTop: 8 }]}><Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={done ? C.ok : C.mu} /><Text style={[st.mu, done && { color: C.ok }]}>{done ? 'You attended' : 'Not yet attended'}</Text></View>}
      </View>
    </FadeIn>
  );
}
function Events({ me, reload }) {
  const [rows, setRows] = useState(null), [done, setDone] = useState({}), [ed, setEd] = useState(null), [qr, setQr] = useState(null), [busy, setBusy] = useState(false), [ref, setRef] = useState(false), [fl, setFl] = useState('all');
  const staff = me.role !== 'student', admin = me.role === 'admin';
  const load = useCallback(async () => {
    let q = sb.from('events').select('*, attendance(count)').order('starts_at', { ascending: false });
    if (me.role === 'teacher') q = q.eq('created_by', me.id);
    const { data, error } = await q; if (error) notify(error.message, 'er'); setRows(data || []);
    if (!staff) { const a = await sb.from('attendance').select('event_id').eq('student_id', me.id); setDone(Object.fromEntries((a.data || []).map((x) => [x.event_id, 1]))); }
    reload();
  }, []);
  useEffect(() => { load(); }, []);
  const fn = {
    qr: async (e) => { const { data, error } = await sb.from('event_secrets').select('token').eq('event_id', e.id).single(); error ? notify('Could not load QR', 'er') : setQr({ e, code: `QRATT:${e.id}:${data.token}` }); },
    edit: (e) => { const s = new Date(e.starts_at); setEd({ ...e, date: s.toLocaleDateString('en-CA'), time: s.toTimeString().slice(0, 5) }); },
    toggle: async (e) => { const { error } = await sb.from('events').update({ status: e.status === 'open' ? 'closed' : 'open' }).eq('id', e.id); error ? notify(error.message, 'er') : (notify('Event ' + (e.status === 'open' ? 'closed' : 'reopened')), load()); },
    del: (e) => Alert.alert('Delete event?', 'Its attendance records are deleted too.', [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await sb.from('events').delete().eq('id', e.id); load(); } }]),
  };
  async function save() {
    const d = ed, when = new Date(`${(d.date || '').trim()}T${(d.time || '').trim()}:00`);
    if (!d.name?.trim() || !d.venue?.trim() || isNaN(when)) return notify('Name, venue, date (YYYY-MM-DD) and time (HH:MM) are required.', 'er');
    setBusy(true);
    const body = { name: d.name.trim(), venue: d.venue.trim(), description: (d.description || '').trim(), starts_at: when.toISOString() };
    const { error } = d.id ? await sb.from('events').update(body).eq('id', d.id) : await sb.from('events').insert(body);
    setBusy(false); if (error) return notify(error.message, 'er');
    setEd(null); notify('Event saved'); load();
  }
  const blank = () => { const n = new Date(Date.now() + 36e5); setEd({ date: n.toLocaleDateString('en-CA'), time: n.toTimeString().slice(0, 5) }); };
  const shown = (rows || []).filter((e) => fl === 'all' || e.status === fl);
  return (
    <View style={{ flex: 1 }}>
      <View style={[st.row, { paddingHorizontal: 16, paddingBottom: 8 }]}>{['all', 'open', 'closed'].map((k) => <Press key={k} onPress={() => setFl(k)} style={[st.chip, fl === k && st.chipOn]}><Text style={[st.chipT, fl === k && { color: '#fff' }]}>{k === 'all' ? 'All' : k === 'open' ? 'Open' : 'Closed'}</Text></Press>)}</View>
      {rows === null ? <View style={{ padding: 16 }}><Skels /></View> :
        <FlatList data={shown} keyExtractor={(e) => e.id} contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 140 }} refreshing={ref} onRefresh={async () => { setRef(true); await load(); setRef(false); }}
          ListEmptyComponent={<Empty icon="calendar-outline" t={staff ? 'No events here yet. Tap + to create one.' : 'No events here yet. Check back soon.'} />}
          renderItem={({ item, index }) => <EvCard e={item} i={index} staff={staff} admin={admin} done={done[item.id]} fn={fn} />} />}
      {staff && <Press onPress={blank} style={st.fab} s={0.9}><LinearGradient colors={GA} style={st.fabI}><Ionicons name="add" size={30} color="#fff" /></LinearGradient></Press>}
      <Modal visible={!!ed} transparent animationType="slide" onRequestClose={() => setEd(null)}>
        <View style={st.mo}><ScrollView style={st.sheet} keyboardShouldPersistTaps="handled">
          <Text style={st.h2}>{ed?.id ? 'Edit event' : 'New event'}</Text>
          {[['Event name', 'name', 'sparkles-outline'], ['Venue', 'venue', 'location-outline'], ['Date (YYYY-MM-DD)', 'date', 'calendar-outline'], ['Time (HH:MM, 24h)', 'time', 'time-outline'], ['Description', 'description', 'document-text-outline']].map(([l, k, ic]) => <Field key={k} l={l} icon={ic} value={ed?.[k]} onChangeText={(v) => setEd((o) => ({ ...o, [k]: v }))} maxLength={k === 'description' ? 300 : 80} />)}
          <View style={[st.row, { marginTop: 16, marginBottom: 20 }]}><Btn t="Save event" busy={busy} onPress={save} /><Btn kind="g" t="Cancel" onPress={() => setEd(null)} /></View>
        </ScrollView></View>
      </Modal>
      <Modal visible={!!qr} transparent animationType="fade" onRequestClose={() => setQr(null)}>
        <View style={[st.mo, { justifyContent: 'center', padding: 20 }]}><FadeIn style={[st.sheet, { alignItems: 'center', borderRadius: 28 }]}>
          <Text style={st.h2}>{qr?.e.name}</Text><Text style={[st.mu, { marginBottom: 14 }]}>Students scan this to check in</Text>
          <LinearGradient colors={GA} style={{ padding: 3, borderRadius: 22 }}><View style={{ backgroundColor: '#fff', padding: 14, borderRadius: 19 }}>{qr && <QRCode value={qr.code} size={220} />}</View></LinearGradient>
          <View style={{ marginTop: 18 }}><Btn kind="g" t="Done" onPress={() => setQr(null)} /></View>
        </FadeIn></View>
      </Modal>
    </View>
  );
}

/* ---------- student scan ---------- */
const OUT = { ok: ['ok', 'checkmark', 'You’re checked in', 'Attendance recorded.'], late: ['wa', 'time', 'Recorded as late', 'You checked in after the grace period.'], duplicate: ['wa', 'alert', 'Already recorded', 'Duplicate attendance blocked.'], closed: ['wa', 'lock-closed', 'Event closed', 'This event no longer accepts attendance.'], invalid: ['er', 'close', 'Invalid QR code', 'This is not a valid event code.'], forbidden: ['er', 'close', 'Not allowed', 'Only students can record attendance.'] };
function Scan({ reload }) {
  const [perm, ask] = useCameraPermissions(), [res, setRes] = useState(null), lock = useRef(false), pop = useRef(new Animated.Value(0)).current, ln = useRef(new Animated.Value(0)).current;
  useEffect(() => loop(ln, 0, 1, 1500), []);
  async function onScan({ data }) {
    if (lock.current) return; lock.current = true;
    const { data: r, error } = await sb.rpc('record_attendance', { p_code: data });
    const o = error ? ['er', 'close', 'Something went wrong', error.message] : OUT[r] || OUT.invalid;
    hap(o[0]); setRes(o); pop.setValue(0); Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 5 }).start(); reload();
  }
  if (!perm) return <ActivityIndicator color={C.a} style={{ marginTop: 40 }} />;
  if (!perm.granted) return <FadeIn style={[st.card, { margin: 16 }]}><Text style={{ color: C.tx, marginBottom: 12 }}>Camera access is needed to scan event QR codes.</Text><Btn t="Allow camera" icon="camera" onPress={ask} /></FadeIn>;
  return (
    <View style={{ flex: 1, padding: 16 }}>
      <View style={st.cam}>
        <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={res ? undefined : onScan} />
        <View style={st.finder}>{['tl', 'tr', 'bl', 'br'].map((c) => <View key={c} style={[st.cn, st['c' + c]]} />)}
          <Animated.View style={[st.scanLn, { transform: [{ translateY: ln.interpolate({ inputRange: [0, 1], outputRange: [0, 210] }) }] }]} /></View>
        <Text style={st.hint}>Point at the event QR</Text>
      </View>
      {res && <Animated.View style={[st.over, { opacity: pop }]}><Animated.View style={{ alignItems: 'center', transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] }}>
        <View style={[st.circle, { borderColor: C[res[0]], shadowColor: C[res[0]] }]}><Ionicons name={res[1]} size={58} color={C[res[0]]} /></View>
        <Text style={[st.h1, { color: C[res[0]] }]}>{res[2]}</Text><Text style={st.resT}>{res[3]}</Text>
        <Btn kind="g" t="Scan again" icon="scan" onPress={() => { setRes(null); lock.current = false; }} /></Animated.View></Animated.View>}
    </View>
  );
}

/* ---------- lists ---------- */
function useList(fn, deps = []) { const [r, setR] = useState(null), [ref, setRef] = useState(false); const load = useCallback(async () => { const x = await fn(); if (x.error) notify(x.error.message, 'er'); setR(x.data || []); }, deps); useEffect(() => { load(); }, [load]); return [r, load, ref, async () => { setRef(true); await load(); setRef(false); }]; }
function History({ me }) {
  const [rows, , ref, onRef] = useList(() => sb.from('attendance').select('id,status,created_at,events(name,venue)').eq('student_id', me.id).order('created_at', { ascending: false }));
  return rows === null ? <View style={{ padding: 16 }}><Skels /></View> : <FlatList data={rows} keyExtractor={(r) => r.id} refreshing={ref} onRefresh={onRef} contentContainerStyle={{ padding: 16, paddingBottom: 140 }} ListEmptyComponent={<Empty icon="time-outline" t="No attendance yet. Scan an event QR to start." />}
    renderItem={({ item: r, index }) => <FadeIn d={Math.min(index, 6) * 50} style={st.line}><View style={[st.bar, { backgroundColor: stC[r.status] }]} /><View style={{ flex: 1 }}><View style={[st.row, { justifyContent: 'space-between' }]}><Text style={st.h3}>{r.events?.name || 'Deleted event'}</Text><Badge s={r.status} /></View><Text style={st.mu}>{fmt(r.created_at)} · {r.events?.venue}</Text></View></FadeIn>} />;
}
function Records({ me }) {
  const [ev, setEv] = useState([]), [sel, setSel] = useState(null), adm = me.role === 'admin';
  useEffect(() => { let q = sb.from('events').select('id,name').order('starts_at', { ascending: false }); if (me.role === 'teacher') q = q.eq('created_by', me.id); q.then((r) => setEv(r.data || [])); }, []);
  const [rows, load, ref, onRef] = useList(() => { let q = sb.from('attendance').select('id,status,created_at,events(name),profiles(full_name,id_no)').order('created_at', { ascending: false }); if (sel) q = q.eq('event_id', sel); return q; }, [sel]);
  const n = (s) => (rows || []).filter((r) => r.status === s).length, tot = Math.max(1, rows?.length || 0);
  const cyc = async (r) => { if (!adm) return; const o = ['Present', 'Late', 'Absent']; await sb.from('attendance').update({ status: o[(o.indexOf(r.status) + 1) % 3] }).eq('id', r.id); load(); };
  const rm = (r) => adm && Alert.alert('Remove record?', '', [{ text: 'Cancel' }, { text: 'Remove', style: 'destructive', onPress: async () => { await sb.from('attendance').delete().eq('id', r.id); load(); } }]);
  return (<View style={{ flex: 1 }}>
    <View style={{ height: 46 }}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>{[{ id: null, name: 'All events' }, ...ev].map((e) => <Press key={e.id || 'all'} onPress={() => setSel(e.id)} style={[st.chip, sel === e.id && st.chipOn]}><Text style={[st.chipT, sel === e.id && { color: '#fff' }]}>{e.name}</Text></Press>)}</ScrollView></View>
    <View style={{ paddingHorizontal: 16, marginBottom: 6 }}><View style={st.split}>{[['Present', C.ok], ['Late', C.wa], ['Absent', C.er]].map(([k, c]) => n(k) > 0 && <View key={k} style={{ flex: n(k) / tot, backgroundColor: c }} />)}</View>
      <Text style={[st.mu, { marginTop: 6 }]}>Present {n('Present')} · Late {n('Late')} · Absent {n('Absent')}{adm ? '  — tap to change, hold to remove' : ''}</Text></View>
    {rows === null ? <View style={{ padding: 16 }}><Skels /></View> : <FlatList data={rows} keyExtractor={(r) => r.id} refreshing={ref} onRefresh={onRef} contentContainerStyle={{ padding: 16, paddingTop: 6, paddingBottom: 140 }} ListEmptyComponent={<Empty icon="list-outline" t="No attendance records yet." />}
      renderItem={({ item: r, index }) => <FadeIn d={Math.min(index, 6) * 40}><Press onPress={() => cyc(r)} onLongPress={() => rm(r)} s={0.98} style={st.line}><Avatar n={r.profiles?.full_name} size={40} /><View style={{ flex: 1, marginLeft: 12 }}><View style={[st.row, { justifyContent: 'space-between' }]}><Text style={st.h3}>{r.profiles?.full_name || 'Unknown'}</Text><Badge s={r.status} /></View><Text style={st.mu}>{r.events?.name} · {fmt(r.created_at)}</Text></View></Press></FadeIn>} />}</View>);
}
function Users({ me }) {
  const [rows, load, ref, onRef] = useList(() => sb.from('profiles').select('*').order('created_at'));
  const next = async (u) => { if (u.id === me.id) return notify('You can’t change your own role.', 'er'); const o = ['student', 'teacher', 'admin']; await sb.from('profiles').update({ role: o[(o.indexOf(u.role) + 1) % 3] }).eq('id', u.id); notify('Role updated'); load(); };
  return rows === null ? <View style={{ padding: 16 }}><Skels /></View> : <FlatList data={rows} keyExtractor={(u) => u.id} refreshing={ref} onRefresh={onRef} contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
    renderItem={({ item: u, index }) => <FadeIn d={Math.min(index, 6) * 40} style={st.line}><Avatar n={u.full_name} /><View style={{ flex: 1, marginLeft: 12 }}><Text style={st.h3}>{u.full_name}</Text><Text style={st.mu}>{u.id_no} {u.section ? '· ' + u.section : ''}</Text></View><Btn small kind="g" t={u.role} onPress={() => next(u)} /></FadeIn>} />;
}
function Profile({ me, reload }) {
  const [f, setF] = useState({ full_name: me.full_name, id_no: me.id_no || '', section: me.section || '' }), [busy, setBusy] = useState(false);
  const save = async () => { if (!f.full_name.trim() || !f.id_no.trim()) return notify('Name and ID are required.', 'er'); setBusy(true); const { error } = await sb.from('profiles').update({ full_name: f.full_name.trim(), id_no: f.id_no.trim(), section: f.section.trim() }).eq('id', me.id); setBusy(false); error ? notify(error.message, 'er') : (notify('Profile saved'), reload(true)); };
  return (<ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
    <FadeIn style={st.idc}><LinearGradient colors={G} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[st.row, { padding: 14, justifyContent: 'space-between' }]}><View style={st.row}><Ionicons name="qr-code" size={18} color={C.a} /><Text style={{ color: '#fff', fontWeight: '800' }}>QR-ATT</Text></View><Text style={st.role}>{me.role}</Text></LinearGradient>
      <View style={{ alignItems: 'center', padding: 18 }}><Avatar n={me.full_name} size={84} /><Text style={[st.h2, { marginTop: 10, marginBottom: 0 }]}>{me.full_name}</Text><Text style={st.mu}>{me.id_no}{me.section ? ' · ' + me.section : ''}</Text></View></FadeIn>
    <FadeIn d={120} style={[st.card, { marginTop: 14 }]}>
      <Field l="Full name" icon="person-outline" value={f.full_name} onChangeText={(v) => setF({ ...f, full_name: v })} maxLength={60} autoCapitalize="words" />
      <Field l="ID number" icon="id-card-outline" value={f.id_no} onChangeText={(v) => setF({ ...f, id_no: v })} maxLength={20} />
      <Field l="Section or department" icon="school-outline" value={f.section} onChangeText={(v) => setF({ ...f, section: v })} maxLength={30} />
      <View style={[st.row, { marginTop: 16 }]}><Btn t="Save profile" busy={busy} onPress={save} /><Btn kind="d" icon="log-out-outline" t="Log out" onPress={() => sb.auth.signOut()} /></View></FadeIn>
  </ScrollView>);
}

/* ---------- shell: gradient header, stat tiles, floating tab bar ---------- */
const TABS = { student: ['Events', 'Scan', 'History', 'Profile'], teacher: ['Events', 'Records', 'Profile'], admin: ['Events', 'Records', 'Users', 'Profile'] };
const ICON = { Events: 'calendar', Scan: 'scan', History: 'time', Records: 'list', Users: 'people', Profile: 'person' };
function TabBtn({ t, on, onPress }) {
  const sc = useRef(new Animated.Value(on ? 1 : 0)).current; useEffect(() => { Animated.spring(sc, { toValue: on ? 1 : 0, useNativeDriver: true, bounciness: 8 }).start(); }, [on]);
  return <Pressable style={st.tab} onPress={onPress}><Animated.View style={{ alignItems: 'center', transform: [{ scale: sc.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) }, { translateY: sc.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) }] }}><Ionicons name={on ? ICON[t] : ICON[t] + '-outline'} size={22} color={on ? '#fff' : C.mu} /><Text style={[st.tl, on && { color: '#fff' }]}>{t}</Text></Animated.View></Pressable>;
}
function TabBar({ tabs, tab, setTab }) {
  const [w, setW] = useState(0), x = useRef(new Animated.Value(0)).current, tw = w / tabs.length, i = tabs.indexOf(tab), ins = useSafeAreaInsets(), y = useRef(new Animated.Value(120)).current;
  useEffect(() => { Animated.spring(y, { toValue: 0, delay: 250, useNativeDriver: true }).start(); }, []);
  useEffect(() => { Animated.spring(x, { toValue: i * tw, useNativeDriver: true, bounciness: 6 }).start(); }, [i, w]);
  return <Animated.View style={[st.tabs, { bottom: ins.bottom + 12, transform: [{ translateY: y }] }]} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
    <Animated.View style={[st.ind, { width: tw, transform: [{ translateX: x }] }]}><LinearGradient colors={GA} style={st.indI} /></Animated.View>
    {tabs.map((t) => <TabBtn key={t} t={t} on={t === tab} onPress={() => setTab(t)} />)}</Animated.View>;
}
function Count3({ tiles }) { return <View style={[st.row, { marginTop: 16 }]}>{tiles.map(([l, v, sx]) => <View key={l} style={st.tile}><Count to={v || 0} suffix={sx} style={st.tileN} /><Text style={st.tileL}>{l}</Text></View>)}</View>; }
function Shell({ me, reload }) {
  const tabs = TABS[me.role], [tab, setTab] = useState(tabs[0]), [s, setS] = useState({}), [tick, setTick] = useState(0), ins = useSafeAreaInsets(), staff = me.role !== 'student', own = me.role === 'teacher';
  const k = useRef(new Animated.Value(1)).current;
  useEffect(() => { k.setValue(0); Animated.timing(k, { toValue: 1, duration: 280, useNativeDriver: true }).start(); }, [tab]);
  useEffect(() => { (async () => {
    const cnt = (t, f) => { const q = sb.from(t).select('*', { count: 'exact', head: true }); return f ? f(q) : q; };
    const [e, o, a] = await Promise.all([cnt('events', (q) => (own ? q.eq('created_by', me.id) : q)), cnt('events', (q) => { q = q.eq('status', 'open'); return own ? q.eq('created_by', me.id) : q; }), cnt('attendance')]);
    setS({ ev: e.count || 0, open: o.count || 0, att: a.count || 0, rate: e.count ? Math.min(100, Math.round(((a.count || 0) / e.count) * 100)) : 0 });
  })(); }, [tab, tick]);
  const tiles = staff ? [['Events', s.ev], ['Open now', s.open], ['Check-ins', s.att]] : [['Open now', s.open], ['My check-ins', s.att], ['Attendance', s.rate, '%']];
  const rl = () => setTick((t) => t + 1);
  const body = { Events: <Events me={me} reload={rl} />, Scan: <Scan reload={rl} />, History: <History me={me} />, Records: <Records me={me} />, Users: <Users me={me} />, Profile: <Profile me={me} reload={(full) => { rl(); full && reload(); }} /> };
  return (<View style={{ flex: 1 }}>
    <LinearGradient colors={G} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[st.head, { paddingTop: ins.top + 12 }]}>
      <View style={[st.row, { justifyContent: 'space-between' }]}><View style={st.row}><Ionicons name="qr-code" size={20} color={C.a} /><Text style={st.logoS}>QR-ATT</Text></View><Press onPress={() => setTab('Profile')} s={0.9}><Avatar n={me.full_name} size={36} /></Press></View>
      <Animated.View style={{ opacity: k, transform: [{ translateY: k.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}><Text style={st.hTitle}>{tab}</Text><Text style={st.hSub}>{me.full_name} · {me.role}</Text></Animated.View>
      <Count3 tiles={tiles} />
    </LinearGradient>
    <Animated.View style={{ flex: 1, paddingTop: 14, opacity: k, transform: [{ translateX: k.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>{body[tab]}</Animated.View>
    <TabBar tabs={tabs} tab={tab} setTab={setTab} />
  </View>);
}
function Main() {
  const [me, setMe] = useState(undefined);
  const loadMe = async (s) => { if (!s) return setMe(null); const { data } = await sb.from('profiles').select('*').eq('id', s.user.id).single(); setMe(data || null); };
  useEffect(() => { const { data } = sb.auth.onAuthStateChange((ev, s) => { setTimeout(() => loadMe(s), 0); }); return () => data.subscription.unsubscribe(); }, []);
  return (<View style={{ flex: 1, backgroundColor: C.bg }}><StatusBar barStyle="light-content" />
    {me === undefined ? <ActivityIndicator color={C.a} style={{ marginTop: 120 }} /> : !me ? <Auth /> : <Shell key={me.id + me.role} me={me} reload={() => sb.auth.getSession().then(({ data }) => loadMe(data.session))} />}<Toast /></View>);
}
export default function App() { return <SafeAreaProvider><Main /></SafeAreaProvider>; }

const st = StyleSheet.create({
  hero: { alignItems: 'center', paddingBottom: 56, borderBottomLeftRadius: 36, borderBottomRightRadius: 36 }, mark: { width: 84, height: 84, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: C.bd, alignItems: 'center', justifyContent: 'center' },
  logo: { fontSize: 38, fontWeight: '800', color: '#fff', letterSpacing: 2, marginTop: 14 }, heroSub: { color: '#bfe9f5', marginTop: 2 }, logoS: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  head: { paddingHorizontal: 18, paddingBottom: 18, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 }, hTitle: { fontSize: 30, fontWeight: '800', color: '#fff', marginTop: 10 }, hSub: { color: '#bfe9f5', marginTop: 2 },
  tile: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 12, marginHorizontal: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' }, tileN: { fontSize: 26, fontWeight: '800', color: '#fff' }, tileL: { color: '#bfe9f5', fontSize: 12, fontWeight: '600' },
  h1: { fontSize: 28, fontWeight: '800', marginTop: 18 }, h2: { fontSize: 22, fontWeight: '800', color: C.tx, marginBottom: 8 }, h3: { fontSize: 16, fontWeight: '700', color: C.tx, flexShrink: 1, marginTop: 2 }, mu: { color: C.mu, fontSize: 13 }, desc: { color: C.tx, opacity: 0.8, marginTop: 6, fontSize: 13 },
  card: { backgroundColor: C.panel, borderColor: C.bd, borderWidth: 1, borderRadius: 24, padding: 18 }, row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  btn: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, sm: { paddingVertical: 7, paddingHorizontal: 12 }, bt: { color: '#fff', fontWeight: '700' },
  gh: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: C.bd }, dng: { backgroundColor: C.er },
  lb: { color: C.mu, fontSize: 12, marginTop: 12 }, fld: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderColor: C.bd, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, marginTop: 4 }, in: { flex: 1, color: C.tx, paddingVertical: 12, fontSize: 15 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 2 }, dot: { width: 6, height: 6, borderRadius: 3 }, badgeT: { fontSize: 11, fontWeight: '700' },
  empty: { color: C.mu, textAlign: 'center', marginTop: 12, fontSize: 15, maxWidth: 260 }, skel: { height: 104, borderRadius: 22, backgroundColor: C.panel, marginBottom: 12 },
  seg: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, borderWidth: 1, borderColor: C.bd, padding: 3 }, segI: { position: 'absolute', top: 3, bottom: 3, left: 3 }, segB: { flex: 1, paddingVertical: 10, alignItems: 'center' }, segT: { color: C.mu, fontWeight: '700' },
  pass: { flexDirection: 'row', backgroundColor: C.panel, borderRadius: 22, marginBottom: 14, borderWidth: 1, borderColor: C.bd, overflow: 'hidden' }, stub: { width: 76, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  sMon: { color: '#fff', opacity: 0.9, fontWeight: '700', fontSize: 12 }, sDay: { color: '#fff', fontWeight: '800', fontSize: 32, lineHeight: 36 }, tear: { width: 0, borderLeftWidth: 1.5, borderStyle: 'dashed', borderColor: C.bd, marginVertical: 8 }, time: { color: C.a, fontWeight: '800', fontSize: 15 },
  ib: { width: 36, height: 36, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: C.bd, marginRight: 8, backgroundColor: C.card }, chipOn: { backgroundColor: C.b, borderColor: C.b }, chipT: { color: C.mu, fontWeight: '700', fontSize: 13 },
  fab: { position: 'absolute', right: 20, bottom: 120 }, fabI: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: C.b, shadowOpacity: 0.6, shadowRadius: 12 },
  line: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.panel, borderWidth: 1, borderColor: C.bd, borderRadius: 18, padding: 14, marginBottom: 10 }, bar: { width: 4, alignSelf: 'stretch', borderRadius: 2, marginRight: 12 }, split: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: C.card },
  toast: { position: 'absolute', left: 20, right: 20, backgroundColor: C.bg, borderWidth: 1, borderRadius: 16, padding: 12, zIndex: 30, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }, tt: { fontWeight: '700', flexShrink: 1 },
  mo: { flex: 1, backgroundColor: 'rgba(3,5,15,0.78)', justifyContent: 'flex-end' }, sheet: { backgroundColor: '#0c1230', borderColor: C.bd, borderWidth: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: '90%' },
  tabs: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', backgroundColor: '#0d1330f2', borderRadius: 26, height: 66, borderWidth: 1, borderColor: C.bd, elevation: 14, shadowColor: C.b, shadowOpacity: 0.4, shadowRadius: 16 }, tab: { flex: 1, alignItems: 'center', justifyContent: 'center' }, tl: { fontSize: 11, fontWeight: '700', color: C.mu },
  ind: { position: 'absolute', top: 0, bottom: 0, padding: 5 }, indI: { flex: 1, borderRadius: 21 },
  cam: { flex: 1, borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: C.bd, alignItems: 'center', justifyContent: 'center', marginBottom: 100 }, finder: { width: 230, height: 230 },
  cn: { position: 'absolute', width: 38, height: 38, borderColor: C.a }, ctl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 16 }, ctr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 16 }, cbl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 16 }, cbr: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 16 },
  scanLn: { height: 3, borderRadius: 2, backgroundColor: C.a, shadowColor: C.a, shadowOpacity: 1, shadowRadius: 8, elevation: 4 }, hint: { position: 'absolute', bottom: 18, color: '#fff', backgroundColor: 'rgba(6,10,24,0.7)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, overflow: 'hidden', fontWeight: '700' },
  over: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,10,24,0.94)', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 5 }, circle: { width: 124, height: 124, borderRadius: 62, borderWidth: 3, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.8, shadowRadius: 22, elevation: 10 }, resT: { color: C.tx, textAlign: 'center', marginVertical: 12, opacity: 0.9 },
  idc: { backgroundColor: C.panel, borderRadius: 26, borderWidth: 1, borderColor: C.bd, overflow: 'hidden' }, role: { color: '#fff', fontWeight: '800', textTransform: 'capitalize', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 3, borderRadius: 12, overflow: 'hidden' },
});
