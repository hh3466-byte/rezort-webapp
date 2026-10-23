import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  Dog, 
  User, 
  Phone, 
  Calendar, 
  DollarSign, 
  Plus, 
  Crown, 
  MessageSquare, 
  AlertCircle,
  Clock,
  Sparkles,
  Gift,
  CreditCard,
  Ticket,
  FileText,
  CheckCircle2,
  Eye,
  PenTool,
  Printer
} from 'lucide-react';
import { Booking, Customer, ResortSettings } from '../types';
import { extractCustomers } from '../utils/storage';
import { formatDateIL } from '../utils/dateUtils';
import { openWhatsAppMessage, cleanPhoneNumber } from '../utils/whatsappUtils';
import { TrainingAgreementModal } from './TrainingAgreementModal';

interface CustomersViewProps {
  bookings: Booking[];
  settings: ResortSettings;
  onNewBookingForCustomer: (customer: Customer) => void;
  onSelectBooking: (booking: Booking) => void;
  onOpenVoucher?: (data: { customerName: string; dogName: string; phone: string; staysCount?: number }) => void;
  onOpenSendPaymentLink?: (booking: Booking) => void;
  onOpenDaycarePassModal?: (customer?: { ownerName?: string; ownerPhone?: string; dogName?: string; dogBreed?: string; ownerEmail?: string }) => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  bookings,
  settings,
  onNewBookingForCustomer,
  onSelectBooking,
  onOpenVoucher,
  onOpenSendPaymentLink,
  onOpenDaycarePassModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [vipFilter, setVipFilter] = useState<'all' | 'vip' | 'debt' | 'agreements'>('all');

  // Modal state for pulling agreements directly from customer file
  const [selectedAgreementBooking, setSelectedAgreementBooking] = useState<Booking | null>(null);
  const [selectedAgreementType, setSelectedAgreementType] = useState<'training' | 'boarding' | 'auto'>('auto');
  const [isAgreementModalOpen, setIsAgreementModalOpen] = useState(false);

  const customers = extractCustomers(bookings);

  // Helper: check if a customer has signed agreements on file
  const getCustomerAgreements = (customer: Customer) => {
    const customerPhoneClean = cleanPhoneNumber(customer.phone);
    const customerBookings = bookings.filter(
      b => (cleanPhoneNumber(b.ownerPhone) === customerPhoneClean || b.ownerName === customer.name) && b.stayStatus !== 'cancelled'
    );

    return customerBookings
      .filter(b => b.isTrainingAgreementSigned || b.isBoardingAgreementSigned || b.trainingAgreement?.ownerSignatureDataUrl || (b as any).boardingAgreement?.ownerSignatureDataUrl || b.signatureDataUrl)
      .map(b => {
        const isTraining = b.serviceType === 'training' || b.serviceType === 'day_training' || Boolean(b.trainingAgreement);
        const agr = isTraining ? b.trainingAgreement : ((b as any).boardingAgreement || b.trainingAgreement);
        const signedDate = agr?.signedDate || b.trainingAgreementSignedAt || (b as any).boardingAgreementSignedAt || b.createdAt;
        return {
          booking: b,
          isTraining,
          title: isTraining ? 'הסכם אילוף כלבים' : 'הסכם שירותי אירוח ותקנון',
          signedDate,
          dogName: b.dogName,
          ownerSignatureDataUrl: agr?.ownerSignatureDataUrl || b.signatureDataUrl,
          ownerIdNumber: agr?.ownerIdNumber,
        };
      });
  };

  const filteredCustomers = customers.filter(c => {
    const agreements = getCustomerAgreements(c);
    if (vipFilter === 'vip' && !c.isVip) return false;
    if (vipFilter === 'debt' && c.openDebt <= 0) return false;
    if (vipFilter === 'agreements' && agreements.length === 0) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      if (q === 'הסכם' || q === 'הסכמים' || q === 'חתום') {
        return agreements.length > 0;
      }
      const matchName = c.name.toLowerCase().includes(q);
      const matchPhone = c.phone.includes(q);
      const matchDog = c.dogs.some(d => d.name.toLowerCase().includes(q) || (d.breed && d.breed.toLowerCase().includes(q)));
      return matchName || matchPhone || matchDog;
    }
    return true;
  });

  const vipCount = customers.filter(c => c.isVip).length;
  const debtCount = customers.filter(c => c.openDebt > 0).length;
  const agreementsCount = customers.filter(c => getCustomerAgreements(c).length > 0).length;

  return (
    <div className="space-y-4">
      
      {/* Header & Stats */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-50 text-green-700 border border-green-200 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900">
              כרטיסי לקוח ותיק מסמכים (מועדון לקוחות)
            </h2>
            <p className="text-xs text-slate-500">
              כרטיסי לקוח עם תיוק הסכמים חתומים ושליפה מהירה בלחיצה
            </p>
          </div>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold flex-wrap">
          <button
            onClick={() => setVipFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              vipFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            כל הלקוחות ({customers.length})
          </button>
          
          <button
            onClick={() => setVipFilter('agreements')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              vipFilter === 'agreements' ? 'bg-emerald-700 text-white font-black shadow-xs' : 'text-emerald-800 hover:text-emerald-950 hover:bg-emerald-50'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>עם הסכם חתום ({agreementsCount})</span>
          </button>

          <button
            onClick={() => setVipFilter('vip')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
              vipFilter === 'vip' ? 'bg-amber-500 text-slate-950 font-black' : 'text-amber-600 hover:text-amber-800'
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            <span>לקוחות קבועים ({vipCount})</span>
          </button>

          <button
            onClick={() => setVipFilter('debt')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
              vipFilter === 'debt' ? 'bg-red-50 text-red-700 border border-red-300' : 'text-red-600 hover:text-red-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            <span>בעלי חוב ({debtCount})</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="חיפוש לפי שם לקוח, טלפון, שם כלב או 'הסכם'..."
          className="w-full bg-white text-slate-900 text-xs sm:text-sm pl-4 pr-10 py-3 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none shadow-xs"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* Customer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredCustomers.length === 0 ? (
          <div className="col-span-full bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500">
            <Users className="w-10 h-10 mx-auto text-slate-400 mb-2" />
            <p className="font-bold text-slate-700">לא נמצאו לקוחות מתאימים</p>
          </div>
        ) : (
          filteredCustomers.map(customer => {
            const customerPhoneClean = cleanPhoneNumber(customer.phone);
            const customerBookings = bookings.filter(
              b => (cleanPhoneNumber(b.ownerPhone) === customerPhoneClean || b.ownerName === customer.name) && b.stayStatus !== 'cancelled'
            );
            const customerAgreements = getCustomerAgreements(customer);

            return (
              <div
                key={customer.id}
                className={`bg-white border rounded-2xl p-5 shadow-xs space-y-4 transition-all hover:shadow-md ${
                  customer.openDebt > 0 ? 'border-red-300 ring-1 ring-red-100' : customer.isVip ? 'border-amber-300 ring-1 ring-amber-100' : 'border-slate-200'
                }`}
              >
                {/* Header: Dog Name(s) in Big Title (Shmulik remembers dogs!), VIP Tag, Debt Tag */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
                        <Dog className="w-4 h-4 text-emerald-600" />
                      </div>
                      <h3 className="font-black text-xl text-slate-900">
                        {customer.dogs.map(d => d.name).join(', ') || 'כלב ללא שם'}
                      </h3>
                      {customer.dogs.some(d => d.breed) && (
                        <span className="text-xs text-slate-500 font-normal">
                          ({customer.dogs.map(d => d.breed).filter(Boolean).join(', ')})
                        </span>
                      )}
                      {customer.isVip && (
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[11px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                          <Crown className="w-3 h-3 text-amber-600" /> לקוח קבוע (VIP)
                        </span>
                      )}
                      {customerAgreements.length > 0 && (
                        <span className="bg-emerald-100 text-emerald-950 border border-emerald-300 text-[11px] px-2 py-0.5 rounded-full font-black flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>הסכם חתום מתויק ({customerAgreements.length})</span>
                        </span>
                      )}
                    </div>

                    {/* Subtitle: Owner name clearly labeled, phone, last visit */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-2">
                      <span className="flex items-center gap-1 font-bold text-slate-800">
                        <User className="w-3.5 h-3.5 text-indigo-500" />
                        <span>בעלים: <span className="font-extrabold text-slate-900">{customer.name}</span></span>
                      </span>
                      <span className="flex items-center gap-1 font-mono text-slate-700" dir="ltr">
                        <Phone className="w-3 h-3 text-green-600" /> {customer.phone}
                      </span>
                      {customer.lastVisit && (
                        <span className="flex items-center gap-1 text-slate-500">
                          <Clock className="w-3 h-3 text-slate-400" /> ביקור אחרון: {formatDateIL(customer.lastVisit)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Financial Overview Tag */}
                  <div className="text-left shrink-0">
                    <span className="text-xs text-slate-500 block">סה״כ שילם</span>
                    <span className="font-extrabold text-sm text-green-600">
                      ₪{customer.totalSpent.toLocaleString()}
                    </span>
                    {customer.openDebt > 0 && (
                      <span className="text-[11px] font-bold text-red-500 block mt-0.5">
                        חוב: ₪{customer.openDebt}
                      </span>
                    )}
                  </div>
                </div>

                {/* Dog Details & History */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 font-semibold">
                      כלבים רשומים ({customer.dogs.length}):
                    </span>
                    <span className="text-slate-700 font-bold">
                      ביקורים בריזורט: <strong className="text-green-600">{customer.totalVisits}</strong>
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {customer.dogs.map((dog, i) => (
                      <div
                        key={i}
                        className="bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 shadow-xs"
                      >
                        <Dog className="w-3.5 h-3.5 text-green-600" />
                        <span className="font-extrabold text-slate-900">{dog.name}</span>
                        {dog.breed && (
                          <span className="text-slate-500 text-[11px]">({dog.breed})</span>
                        )}
                        {dog.specialDiet && (
                          <span className="text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded text-[10px] font-bold border border-amber-200">
                            מזון: {dog.specialDiet}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* ============================================================== */}
                {/* FILED SIGNED AGREEMENTS BOX (תיוק הסכמים חתומים בתיק הלקוח)     */}
                {/* "אני רוצה שאתה תתייק את ההסכמים החתומים בתיק הלקוח כך שיהיה ניתן   */}
                {/* לשלוף אותם בקלות"                                              */}
                {/* ============================================================== */}
                <div className="bg-emerald-50/40 p-3 rounded-xl border border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-black text-slate-900 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-emerald-700" />
                      <span>תיק מסמכים והסכמים חתומים ({customerAgreements.length}):</span>
                    </span>
                    {customerAgreements.length > 0 ? (
                      <span className="bg-emerald-100 text-emerald-950 font-black text-[10px] px-2 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>מתועד ומאומת בתיק ✓</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-medium">
                        טרם נחתם הסכם מתועד
                      </span>
                    )}
                  </div>

                  {customerAgreements.length > 0 ? (
                    <div className="space-y-1.5 pt-0.5">
                      {customerAgreements.map((agr, idx) => (
                        <div
                          key={idx}
                          className="bg-white border border-emerald-200/80 hover:border-emerald-400 rounded-xl p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs transition-all"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center shrink-0">
                              <FileText className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                                <span>{agr.title}</span>
                                <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-1.5 py-0.2 rounded border border-slate-200">
                                  עבור: {agr.dogName}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-500 font-medium flex items-center gap-2 mt-0.5">
                                <span>תאריך חתימה: {formatDateIL(agr.signedDate)}</span>
                                {agr.ownerIdNumber && <span>• ת.ז. {agr.ownerIdNumber}</span>}
                                <span className="text-emerald-700 font-bold">✓ חתום דיגיטלית</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedAgreementBooking(agr.booking);
                                setSelectedAgreementType(agr.isTraining ? 'training' : 'boarding');
                                setIsAgreementModalOpen(true);
                              }}
                              className="py-1 px-3 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white rounded-lg text-xs font-black flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all"
                              title="שלוף הסכם זה לצפייה, הדפסה או הורדה ב-PDF"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>שלוף הסכם 📜</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="pt-1 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-500">
                        ניתן להחתים את הלקוח ישירות על הסכם שירותי הריזורט
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const firstDog = customer.dogs[0];
                          const placeholderBooking: Booking = {
                            id: `b-agr-${cleanPhoneNumber(customer.phone) || Date.now()}`,
                            ownerName: customer.name,
                            ownerPhone: customer.phone,
                            ownerEmail: customer.email,
                            dogName: firstDog?.name || 'כלב',
                            dogBreed: firstDog?.breed || '',
                            serviceType: 'boarding',
                            startDate: new Date().toISOString().split('T')[0],
                            endDate: new Date().toISOString().split('T')[0],
                            totalPrice: 180,
                            depositAmount: 0,
                            paymentStatus: 'unpaid',
                            vaccinationValid: true,
                            stayStatus: 'booked',
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                          };
                          setSelectedAgreementBooking(placeholderBooking);
                          setSelectedAgreementType('boarding');
                          setIsAgreementModalOpen(true);
                        }}
                        className="py-1 px-2.5 bg-white hover:bg-emerald-100 hover:text-emerald-900 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                        title="פתח הסכם חדש לחתימת הלקוח"
                      >
                        <PenTool className="w-3.5 h-3.5 text-emerald-700" />
                        <span>החתם על הסכם ✍️</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Action Buttons: New Booking, Payment Link, Voucher, WhatsApp, Call */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                  <button
                    type="button"
                    onClick={() => onNewBookingForCustomer(customer)}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>הזמנה חדשה</span>
                  </button>

                  {onOpenSendPaymentLink && (
                    <button
                      type="button"
                      onClick={() => {
                        const sortedCustomerBookings = [...customerBookings].sort((a, b) => {
                          const aStaying = a.stayStatus === 'checked_in' ? 1 : 0;
                          const bStaying = b.stayStatus === 'checked_in' ? 1 : 0;
                          if (aStaying !== bStaying) return bStaying - aStaying;
                          const aBooked = a.stayStatus === 'booked' ? 1 : 0;
                          const bBooked = b.stayStatus === 'booked' ? 1 : 0;
                          if (aBooked !== bBooked) return bBooked - aBooked;
                          return new Date(b.startDate || b.createdAt).getTime() - new Date(a.startDate || a.createdAt).getTime();
                        });
                        const targetBooking: Booking = sortedCustomerBookings[0] || {
                          id: 'cust-' + customer.id,
                          dogName: customer.dogs[0]?.name || 'כלב',
                          dogBreed: customer.dogs[0]?.breed || 'מעורב',
                          ownerName: customer.name,
                          ownerPhone: customer.phone,
                          startDate: new Date().toISOString().split('T')[0],
                          endDate: new Date().toISOString().split('T')[0],
                          totalPrice: customer.openDebt || 0,
                          depositAmount: 0,
                          serviceType: 'boarding',
                          stayStatus: 'checked_out',
                          paymentStatus: customer.openDebt > 0 ? 'unpaid' : 'fully_paid',
                          vaccinationValid: true,
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString(),
                        };
                        onOpenSendPaymentLink(targetBooking);
                      }}
                      className="py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border border-emerald-300 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 shrink-0"
                      title="שלח קישור לתשלום ב-Grow / Bit ישירות לוואטסאפ של הלקוח"
                    >
                      <CreditCard className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>קישור לתשלום 💳</span>
                    </button>
                  )}

                  {onOpenVoucher && (
                    <button
                      type="button"
                      onClick={() => onOpenVoucher({
                        customerName: customer.name,
                        dogName: customer.dogs[0]?.name || '',
                        phone: customer.phone,
                        staysCount: customer.totalVisits
                      })}
                      className="py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 shrink-0"
                      title="הפק ושלח שובר הטבה לפעם הבאה או חבר מביא חבר"
                    >
                      <Gift className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>שובר מתנה</span>
                    </button>
                  )}

                  {onOpenDaycarePassModal && (
                    <button
                      type="button"
                      onClick={() => onOpenDaycarePassModal({
                        ownerName: customer.name,
                        ownerPhone: customer.phone,
                        dogName: customer.dogs[0]?.name || '',
                        dogBreed: customer.dogs[0]?.breed || '',
                        ownerEmail: customer.email || ''
                      })}
                      className="py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border border-emerald-300 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 shrink-0"
                      title="הנפק כרטיסיית יומיות ללקוח זה"
                    >
                      <Ticket className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>כרטיסייה 🎟️</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => openWhatsAppMessage(customer.phone, `שלום ${customer.name}, כאן ${settings.managerName} מ${settings.resortName} 🐾`)}
                    className="p-2 bg-slate-100 hover:bg-green-50 text-slate-700 hover:text-green-800 rounded-xl transition-colors cursor-pointer border border-slate-200"
                    title="פתח שיחת וואטסאפ"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>

                  <a
                    href={`tel:${customer.phone}`}
                    className="p-2 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-800 rounded-xl transition-colors cursor-pointer border border-slate-200"
                    title="חייג ללקוח"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                </div>

              </div>
            );
          })
        )}
      </div>

      {/* Agreement Modal for fast retrieval from customer file */}
      {isAgreementModalOpen && selectedAgreementBooking && (
        <TrainingAgreementModal
          isOpen={true}
          onClose={() => {
            setIsAgreementModalOpen(false);
            setSelectedAgreementBooking(null);
          }}
          booking={selectedAgreementBooking}
          agreementType={selectedAgreementType}
          settings={settings}
          onAgreementSigned={() => {
            setIsAgreementModalOpen(false);
            setSelectedAgreementBooking(null);
          }}
        />
      )}

    </div>
  );
};
