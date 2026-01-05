export const PaymentListModule = {
    init: (domElements, context) => {
        domElements.newBtn.addEventListener('click', () => PaymentListModule.showModal(null, domElements, context));
        domElements.modalElements.saveBtn.addEventListener('click', () => PaymentListModule.handleSave(domElements.modalElements, context));
        domElements.modalElements.closeBtn.addEventListener('click', () => domElements.modalElements.modal.style.display = 'none');
    },

    render: async (jobNo, container) => {
        if (!jobNo || !container) return;

        const project = await window.DB.getProject(jobNo);
        const siteData = await window.DB.getSiteData(jobNo);

        const masterInvoices = (project.invoices || []).map(inv => ({...inv, isMaster: true}));
        const manualPayments = siteData.paymentLog || [];

        const allPayments = [...masterInvoices, ...manualPayments].sort((a, b) => new Date(b.date) - new Date(a.date));

        if (allPayments.length === 0) {
            container.innerHTML = '<p>No payments tracked for this project.</p>';
            return;
        }

        let html = `
            <table class="output-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>To Whom</th>
                        <th>Amount (AED)</th>
                        <th>Status/Ref</th>
                        <th>Receipt</th>
                    </tr>
                </thead>
                <tbody>`;

        for (const payment of allPayments) {
            let receiptHtml = 'N/A';
            if (payment.receiptFileId) {
                const file = await window.DB.getFileById(payment.receiptFileId);
                if(file) receiptHtml = `<a href="${file.dataUrl}" download="${file.name}">View</a>`;
            }
            html += `
                <tr style="${payment.isMaster ? 'background-color: #f8f9fa;' : ''}">
                    <td>${payment.date}</td>
                    <td>${payment.description || payment.no}</td>
                    <td>${payment.toWhom || payment.type}</td>
                    <td style="text-align:right;">${(parseFloat(payment.amount) || 0).toLocaleString()}</td>
                    <td>${payment.isMaster ? `Pending (Invoice)` : `${payment.mode || ''} ${payment.refNo || ''}`}</td>
                    <td>${receiptHtml}</td>
                </tr>
            `;
        }
        
        html += `</tbody></table>`;
        container.innerHTML = html;
    },

    showModal: (paymentId, domElements, context) => {
        const M = domElements.modalElements;
        
        // Reset form
        Object.keys(M).forEach(key => {
            if (M[key].tagName === 'INPUT' || M[key].tagName === 'TEXTAREA' || M[key].tagName === 'SELECT') M[key].value = '';
        });
        
        M.modal.style.display = 'flex';
    },

    handleSave: async (modalElements, context) => {
        const M = modalElements;
        const { currentJobNo } = context.getState();

        const amount = M.amount.value;
        const toWhom = M.toWhom.value;
        const date = M.date.value;

        if (!amount || !toWhom || !date) {
            return alert("Date, To Whom, and Amount are required fields.");
        }

        const siteData = await window.DB.getSiteData(currentJobNo);
        if (!siteData.paymentLog) siteData.paymentLog = [];
        
        const newPayment = {
            id: `PAY-${Date.now()}`,
            description: M.description.value.trim(),
            toWhom,
            amount,
            mode: M.mode.value,
            refNo: M.refNo.value.trim(),
            date,
            chaseBy: M.chaseBy.value.trim(),
            chaseDate: M.chaseDate.value
        };

        const file = M.receiptFile.files[0];
        if (file) {
            const dataUrl = await new Promise(r => { const reader = new FileReader(); reader.onload = e => r(e.target.result); reader.readAsDataURL(file); });
            const fileRecord = { jobNo: currentJobNo, source: 'site', type: 'payment_receipt', name: file.name, fileType: file.type, dataUrl };
            newPayment.receiptFileId = await window.DB.addFile(fileRecord);
        }
        
        siteData.paymentLog.push(newPayment);
        await window.DB.putSiteData(siteData);
        
        M.modal.style.display = 'none';
        context.onUpdate('payments'); // Or direct render call
    },
};