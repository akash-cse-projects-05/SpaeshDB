document.addEventListener('DOMContentLoaded', () => {
  // Auto-dismiss flash alerts after 5 seconds
  const alerts = document.querySelectorAll('.alert');
  alerts.forEach(alert => {
    setTimeout(() => {
      alert.style.transition = 'opacity 0.5s ease';
      alert.style.opacity = '0';
      setTimeout(() => alert.remove(), 500);
    }, 5000);
  });

  // Simulated Razorpay integration modal toggling
  const payBtn = document.getElementById('initiate-payment-btn');
  const paymentModal = document.getElementById('payment-modal');
  const closePaymentBtn = document.getElementById('close-payment-btn');

  if (payBtn && paymentModal) {
    payBtn.addEventListener('click', (e) => {
      e.preventDefault();
      paymentModal.style.display = 'flex';
    });
  }

  if (closePaymentBtn && paymentModal) {
    closePaymentBtn.addEventListener('click', () => {
      paymentModal.style.display = 'none';
    });
  }

  // Handle Anonymous signup toggle fields
  const anonCheckbox = document.getElementById('isAnonymous');
  const patientNameGroup = document.getElementById('patient-name-group');
  if (anonCheckbox && patientNameGroup) {
    anonCheckbox.addEventListener('change', (e) => {
      const nameInput = patientNameGroup.querySelector('input');
      if (e.target.checked) {
        patientNameGroup.style.opacity = '0.5';
        nameInput.value = 'Anonymous Patient';
        nameInput.setAttribute('disabled', 'true');
      } else {
        patientNameGroup.style.opacity = '1';
        nameInput.removeAttribute('disabled');
        nameInput.value = '';
      }
    });
  }
});
