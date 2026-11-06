/* Chalé e Camping da Mata — interações do site (sem dependências) */
(() => {
  'use strict';

  const WHATSAPP = '5537988310241';
  const linkWhats = (msg) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
  const reduzMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  /* Ano no rodapé */
  $$('[data-ano]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  /* Links de WhatsApp com mensagem pronta (o href sem texto já funciona sem JS) */
  $$('[data-wa]').forEach((a) => {
    a.href = linkWhats(a.dataset.wa);
    a.target = '_blank';
    a.rel = 'noopener';
  });

  /* Header sólido ao rolar + barra de ações no celular */
  const header = $('#topo');
  const barra = $('#barra-acoes');
  const menu = $('#menu');
  const aoRolar = () => {
    if (menu && !menu.hidden) return;
    const y = window.scrollY;
    header.toggleAttribute('data-solid', y > 24);
    if (barra) barra.toggleAttribute('data-visivel', y > window.innerHeight * 0.55);
  };
  window.addEventListener('scroll', aoRolar, { passive: true });
  aoRolar();

  /* Menu em tela cheia (celular) */
  const botaoMenu = $('#menu-botao');
  if (botaoMenu && menu) {
    const abrirMenu = (abrir) => {
      menu.hidden = !abrir;
      botaoMenu.setAttribute('aria-expanded', String(abrir));
      botaoMenu.setAttribute('aria-label', abrir ? 'Fechar menu' : 'Abrir menu');
      $('[data-icone="abrir"]', botaoMenu).classList.toggle('hidden', abrir);
      $('[data-icone="fechar"]', botaoMenu).classList.toggle('hidden', !abrir);
      document.documentElement.classList.toggle('menu-aberto', abrir);
      if (abrir) {
        header.removeAttribute('data-solid');
        barra?.removeAttribute('data-visivel');
        $('a', menu)?.focus();
      } else {
        aoRolar();
      }
    };
    botaoMenu.addEventListener('click', () => abrirMenu(menu.hidden));
    $$('a', menu).forEach((a) => a.addEventListener('click', () => abrirMenu(false)));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !menu.hidden) {
        abrirMenu(false);
        botaoMenu.focus();
      }
    });
    window.matchMedia('(min-width: 1024px)').addEventListener('change', (e) => {
      if (e.matches && !menu.hidden) abrirMenu(false);
    });
  }

  /* Galerias com scroll-snap: pontinhos, contador e setas */
  $$('[data-galeria]').forEach((galeria) => {
    const trilho = $('[data-trilho]', galeria);
    const fotos = [...trilho.children];
    const pontos = $('[data-pontos]', galeria);
    const contador = $('[data-contador]', galeria);
    let atual = 0;

    const irPara = (i) => {
      trilho.scrollTo({ left: fotos[i].offsetLeft, behavior: reduzMovimento ? 'auto' : 'smooth' });
    };

    fotos.forEach((_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ponto';
      b.setAttribute('aria-label', `Foto ${i + 1} de ${fotos.length}`);
      b.appendChild(document.createElement('span'));
      b.addEventListener('click', () => irPara(i));
      pontos.appendChild(b);
    });

    const marcar = (i) => {
      atual = i;
      [...pontos.children].forEach((p, j) => p.setAttribute('aria-current', j === i ? 'true' : 'false'));
      if (contador) contador.textContent = `${i + 1}/${fotos.length}`;
    };

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entradas) => {
        entradas.forEach((en) => { if (en.isIntersecting) marcar(fotos.indexOf(en.target)); });
      }, { root: trilho, threshold: 0.6 });
      fotos.forEach((f) => io.observe(f));
    }

    $('[data-anterior]', galeria)?.addEventListener('click', () => irPara((atual - 1 + fotos.length) % fotos.length));
    $('[data-proximo]', galeria)?.addEventListener('click', () => irPara((atual + 1) % fotos.length));
    marcar(0);
  });

  /* Formulário de disponibilidade → WhatsApp */
  const form = $('#form-disponibilidade');
  if (form) {
    const { entrada, saida, adultos, criancas, hospedagem } = form.elements;
    const erro = $('#form-erro');
    const isoLocal = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const paraBR = (iso) => iso.split('-').reverse().join('/');
    const diaSeguinte = (iso) => {
      const d = new Date(`${iso}T12:00:00`);
      d.setDate(d.getDate() + 1);
      return isoLocal(d);
    };

    entrada.min = isoLocal(new Date());
    saida.min = diaSeguinte(entrada.min);

    const limparErro = () => {
      erro.classList.add('hidden');
      erro.textContent = '';
      [entrada, saida].forEach((c) => c.removeAttribute('aria-invalid'));
    };
    const falhar = (msg, campo) => {
      erro.textContent = msg;
      erro.classList.remove('hidden');
      campo.setAttribute('aria-invalid', 'true');
      campo.focus();
    };

    entrada.addEventListener('change', () => {
      limparErro();
      if (!entrada.value) return;
      saida.min = diaSeguinte(entrada.value);
      if (saida.value && saida.value <= entrada.value) saida.value = '';
    });
    saida.addEventListener('change', limparErro);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      limparErro();
      if (!entrada.value) return falhar('Escolha a data de entrada.', entrada);
      if (!saida.value) return falhar('Escolha a data de saída.', saida);
      if (entrada.value < entrada.min) return falhar('A data de entrada já passou. Escolha uma data a partir de hoje.', entrada);
      if (saida.value <= entrada.value) return falhar('A data de saída precisa ser depois da entrada.', saida);

      const diarias = Math.round((new Date(`${saida.value}T12:00:00`) - new Date(`${entrada.value}T12:00:00`)) / 86400000);
      const nAdultos = adultos.value;
      const nCriancas = criancas.value;
      let pessoas = `${nAdultos} ${nAdultos === '1' ? 'adulto' : 'adultos'}`;
      if (nCriancas !== '0') pessoas += ` e ${nCriancas} ${nCriancas === '1' ? 'criança' : 'crianças'}`;
      const oQue = hospedagem.selectedOptions[0].dataset.frase;

      const msg = `Olá, Amanda! Vim pelo site e gostaria de verificar a disponibilidade ${oQue} `
        + `para entrada em ${paraBR(entrada.value)} e saída em ${paraBR(saida.value)} `
        + `(${diarias} ${diarias === 1 ? 'diária' : 'diárias'}), para ${pessoas}.`;

      const url = linkWhats(msg);
      const janela = window.open(url, '_blank');
      if (janela) janela.opener = null;
      else window.location.href = url;
    });

    /* Botões "Ver datas disponíveis" dos cards já escolhem a hospedagem */
    $$('[data-escolher]').forEach((a) => {
      a.addEventListener('click', () => {
        hospedagem.value = a.dataset.escolher;
        form.classList.remove('destaque');
        void form.offsetWidth; // reinicia a animação
        form.classList.add('destaque');
      });
    });
  }

  /* Aparecer suavemente ao rolar */
  const revelar = $$('.revelar');
  if (!('IntersectionObserver' in window) || reduzMovimento) {
    revelar.forEach((el) => el.classList.add('visivel'));
  } else {
    const io = new IntersectionObserver((entradas) => {
      entradas.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('visivel');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    revelar.forEach((el) => io.observe(el));
  }
})();
