const fs = require('fs');

// We can extract getShabbatOrHolidaySchedule from jewishCalendar or test its calculation
function getSunsetAndHavdalah(date) {
  // Approximate for Israel in September
  // Sunset ~ 18:35, Havdalah (42m after sunset) ~ 19:17
  // sendMinutes = havdalah + 40m = 19:57
}

const { isCustomerMessagingRestrictedNow } = require('../src/utils/jewishCalendar.ts');
