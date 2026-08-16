import { useFormContext } from 'react-hook-form';
import { BookingSubmitInput } from '@/lib/validation/booking.schema';
import { Input } from '@/components/ui/input';

export function LocationCustomerStep() {
  const { register, formState: { errors } } = useFormContext<BookingSubmitInput>();

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-white mb-3">Your Information</h2>
        <p className="text-muted-text">Where should we send the technician?</p>
      </div>

      <div className="space-y-8">
        
        {/* Contact Info */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-primary-blue uppercase tracking-wider border-b border-border/50 pb-2">Contact Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm text-muted-text">First Name *</label>
              <Input {...register('firstName')} className="bg-background/50" placeholder="John" />
              {errors.firstName && <p className="text-danger text-xs">{errors.firstName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-text">Last Name *</label>
              <Input {...register('lastName')} className="bg-background/50" placeholder="Doe" />
              {errors.lastName && <p className="text-danger text-xs">{errors.lastName.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm text-muted-text">Email *</label>
              <Input {...register('email')} type="email" className="bg-background/50" placeholder="john@example.com" />
              {errors.email && <p className="text-danger text-xs">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-text">Phone *</label>
              <Input {...register('phone')} type="tel" className="bg-background/50" placeholder="(555) 123-4567" />
              {errors.phone && <p className="text-danger text-xs">{errors.phone.message}</p>}
            </div>
          </div>
        </div>

        {/* Location Info */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-primary-blue uppercase tracking-wider border-b border-border/50 pb-2">Service Location</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-sm text-muted-text">Street Address *</label>
              <Input {...register('address')} className="bg-background/50" placeholder="123 Main St" />
              {errors.address && <p className="text-danger text-xs">{errors.address.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-text">Unit/Apt</label>
              <Input {...register('unit')} className="bg-background/50" placeholder="Apt 4B" />
              {errors.unit && <p className="text-danger text-xs">{errors.unit.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm text-muted-text">City *</label>
              <Input {...register('city')} className="bg-background/50" placeholder="Winnipeg" />
              {errors.city && <p className="text-danger text-xs">{errors.city.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-text">Province *</label>
              <Input {...register('province')} className="bg-background/50 uppercase" placeholder="MB" maxLength={2} />
              {errors.province && <p className="text-danger text-xs">{errors.province.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-text">Postal Code *</label>
              <Input {...register('postalCode')} className="bg-background/50 uppercase" placeholder="R3C 1A1" />
              {errors.postalCode && <p className="text-danger text-xs">{errors.postalCode.message}</p>}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
