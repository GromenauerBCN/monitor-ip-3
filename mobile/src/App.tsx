import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, TextInput, Button, FlatList, TouchableOpacity } from 'react-native';
import * as Notifications from 'expo-notifications';
import axios from 'axios';

const API = axios.create({ baseURL: process.env.EXPO_PUBLIC_API_BASE || 'http://10.0.2.2:8080' });

export default function App() {
  const [token, setToken] = useState<string|null>(null);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [jwt, setJwt] = useState<string|null>(null);
  const [targets, setTargets] = useState<any[]>([]);
  const [label,setLabel]=useState(''); const [kind,setKind]=useState<'http'|'tcp'>('http');
  const [address,setAddress]=useState(''); const [port,setPort]=useState<string>('');

  useEffect(() => { (async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;
    const token = await Notifications.getExpoPushTokenAsync();
    setToken(token.data);
  })(); }, []);

  const login = async () => {
    const { data } = await API.post('/api/auth/login', { email, password });
    setJwt(data.token);
    API.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    if (token) await API.post('/api/push/register', { expoToken: token });
    load();
  };

  const load = async () => {
    const { data } = await API.get('/api/targets'); setTargets(data);
  };

  const add = async () => {
    const p = kind==='tcp' ? Number(port) : undefined;
    await API.post('/api/targets', { label, kind, address, port: p, intervalMinutes: 20 });
    setLabel(''); setAddress(''); setPort('');
    load();
  };

  if (!jwt) {
    return (
      <SafeAreaView style={{ flex:1, justifyContent:'center', padding:16 }}>
        <Text style={{ fontSize:24, marginBottom:8 }}>MonitorIP</Text>
        <TextInput placeholder="Email" value={email} onChangeText={setEmail} style={{ borderWidth:1, marginBottom:6, padding:8 }} />
        <TextInput placeholder="Password" value={password} secureTextEntry onChangeText={setPassword} style={{ borderWidth:1, marginBottom:6, padding:8 }} />
        <Button title="Login" onPress={login} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex:1, padding:16 }}>
      <Text style={{ fontSize:22, marginBottom:8 }}>Adreces</Text>
      <View style={{ flexDirection:'row', gap:6, marginBottom:8 }}>
        <TextInput placeholder="Etiqueta" value={label} onChangeText={setLabel} style={{ borderWidth:1, padding:8, flex:1 }} />
        <TouchableOpacity onPress={()=>setKind(kind==='http'?'tcp':'http')} style={{ borderWidth:1, padding:8, justifyContent:'center' }}>
          <Text>{kind.toUpperCase()}</Text>
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection:'row', gap:6, marginBottom:8 }}>
        <TextInput placeholder="URL o Host" value={address} onChangeText={setAddress} style={{ borderWidth:1, padding:8, flex:2 }} />
        {kind==='tcp' && <TextInput placeholder="Port" value={port} onChangeText={setPort} keyboardType="numeric" style={{ borderWidth:1, padding:8, flex:1 }} />}
        <Button title="Afegir" onPress={add} />
      </View>
      <FlatList
        data={targets}
        keyExtractor={(item)=>item.id}
        renderItem={({item})=>(
          <View style={{ paddingVertical:8, borderBottomWidth:1, borderColor:'#ddd' }}>
            <Text style={{ fontWeight:'bold' }}>{item.label}</Text>
            <Text>{item.kind.toUpperCase()} · {item.address}{item.port?':'+item.port:''}</Text>
            <View style={{ flexDirection:'row', gap:6, marginTop:4 }}>
              <Button title="Check" onPress={async()=>{ await API.post(`/api/targets/${item.id}/check`); }} />
              <Button color="#ef4444" title="Del" onPress={async()=>{ await API.delete(`/api/targets/${item.id}`); load(); }} />
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
