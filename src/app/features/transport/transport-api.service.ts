import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map } from 'rxjs';
import { DeliveryOrder, DeliveryParty, DeliveryRecord } from './transport.models';
import { apiBaseUrl } from '../../app-config';
const base = `${apiBaseUrl()}/businesses`;
@Injectable({providedIn:'root'}) export class TransportApiService {
  constructor(private readonly http:HttpClient){}
  list(id:string, search=''){const params=new HttpParams().set('search',search);return this.http.get<any>(`${this.url(id)}/deliveries`,{params,withCredentials:true}).pipe(map(x=>x.data));}
  get(id:string, deliveryId:string){return this.http.get<any>(`${this.url(id)}/deliveries/${encodeURIComponent(deliveryId)}`,{withCredentials:true}).pipe(map(x=>x.data as DeliveryRecord));}
  orders(id:string,deliveryId?:string){const params=deliveryId?new HttpParams().set('deliveryId',deliveryId):undefined;return this.http.get<any>(`${this.url(id)}/deliveries/orders`,{params,withCredentials:true}).pipe(map(x=>x.data as {items:DeliveryOrder[];businessAddress:string;business:{name:string;phone:string}}));}
  parties(id:string, search:string){return this.http.get<any>(`${this.url(id)}/deliveries/parties`,{params:new HttpParams().set('search',search),withCredentials:true}).pipe(map(x=>x.data as DeliveryParty[]));}
  addresses(id:string, partyId:string){return this.http.get<any>(`${this.url(id)}/deliveries/parties/${encodeURIComponent(partyId)}/addresses`,{withCredentials:true}).pipe(map(x=>x.data as Array<{id?:string;formatted:string;isDefault:boolean;label:string;contactName:string;phone:string;line1:string;line2:string;city:string;state:string;pincode:string;country:string}>));}
  addPartyAddress(id:string,partyId:string,address:{contactName:string;phone:string;line1:string;line2:string;city:string;state:string;pincode:string;country:string}){return this.http.post<any>(`${this.url(id)}/deliveries/parties/${encodeURIComponent(partyId)}/addresses`,{...address,label:'other'},{withCredentials:true}).pipe(map(x=>x.data as {id:string;formatted:string;isDefault:boolean;label:string;contactName:string;phone:string;line1:string;line2:string;city:string;state:string;pincode:string;country:string}));}
  searchUsers(id:string,search:string){return this.http.get<any>(`${this.url(id)}/deliveries/users`,{params:new HttpParams().set('search',search),withCredentials:true}).pipe(map(x=>x.data as Array<DeliveryParty&{addressCount:number}>));}
  createUser(id:string,body:{name:string;countryCallingCode:string;phoneNumber:string}){return this.http.post<any>(`${this.url(id)}/deliveries/users`,body,{withCredentials:true}).pipe(map(x=>x.data as DeliveryParty&{addressCount:number}));}
  create(id:string, body:unknown){return this.http.post<any>(`${this.url(id)}/deliveries`,body,{withCredentials:true}).pipe(map(x=>x.data as DeliveryRecord));}
  update(id:string, deliveryId:string, body:unknown){return this.http.put<any>(`${this.url(id)}/deliveries/${encodeURIComponent(deliveryId)}`,body,{withCredentials:true}).pipe(map(x=>x.data as DeliveryRecord));}
  action(id:string, deliveryId:string, action:string, details:Record<string,unknown>={}){return this.http.post<any>(`${this.url(id)}/deliveries/${encodeURIComponent(deliveryId)}/actions`,{action,...details},{withCredentials:true}).pipe(map(x=>x.data as DeliveryRecord));}
  private url(id:string){return `${base}/${encodeURIComponent(id)}`;}
}
