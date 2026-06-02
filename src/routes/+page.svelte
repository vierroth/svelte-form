<script lang="ts">
  import { createForm } from "$lib/index.js";
  import { z } from "zod";

  const form = createForm({
    schema: z.object({
      name: z
        .string()
        .trim()
        .regex(/^[A-Za-z ]*$/, "Can only contain letters and spaces")
        .min(1, "Required")
        .max(80, "Can't be longer then 80 characters").default("Default"),
      age: z
        .coerce
        .number()
        .int()
        .positive(),
      position: z
        .string()
        .trim()
        .regex(/^[A-Za-z ]*$/, "Can only contain letters and spaces")
        .min(1, "Required")
        .max(20, "Can't be longer then 20 characters"),
      phoneNumber: z
        .string()
        .trim()
        .regex(/^[0-9+ -]*$/, "Can only contain numbers and +/-")
        .max(20, "Can't be longer then 20 characters")
        .optional(),
      eula: z.literal(true),
    }),
    async onSubmit(formData) {
      console.log(formData)
    },
    onSuccess() {
      // location.reload();
    },
    onError(error: any) {
      console.log(error);
    },
  });

  // $inspect(form)
</script>

<svelte:head>
  <title>Complete Profile - Jumper</title>
</svelte:head>

<div class="container">
  <h1>Complete Your Profile</h1>
  <div class="complete">
    <form use:form.action>
      <label for="name">Full Name*</label>
      <input
        name="name"
        bind:value={form.data.name}
        type="text"
        style="display: block"
      />
      {#if form.errors.name}
        <p style="color: red;">{form.errors.name}</p>
      {/if}
      <br />
      <label for="age">Age*</label>
      <input
        name="age"
        bind:value={form.data.age}
        type="text"
        style="display: block"
      />
      {#if form.errors.age}
        <p style="color: red;">{form.errors.age}</p>
      {/if}
      <br />
      <label for="position">Position*</label>
      <input
        name="position"
        bind:value={form.data.position}
        type="text"
        style="display: block"
      />
      {#if form.errors.position}
        <p style="color: red;">{form.errors.position}</p>
      {/if}
      <br />
      <label for="phoneNumber">Phone Number</label>
      <input
        name="phoneNumber"
        bind:value={form.data.phoneNumber}
        type="text"
        inputmode="tel"
        style="display: block"
      />
      <br />
      <label for="eula">Term and Conditions</label>
      <input
        name="eula"
        bind:checked={form.data.eula}
        type="checkbox"
      />
      <span id="terms"
        >Click here to Accept <a href="/eula.pdf" target="_blank"
          >Terms and Conditions</a
        ></span
      >
      {#if form.errors.submit}
        <span style="color: #d4514c">{@html form.errors.submit}</span>
        <br />
        <br />
      {/if}
      <button
        type="submit"
        disabled={form.isSubmitting || !form.isValid || null}
        style="display: block"
      >
      	{form.isSubmitting ? "Completing..." : "Complete"}
      </button>
      <button
        type="reset"
        style="display: block"
      >
      	Reset
      </button>
    </form>
  </div>
</div>

<style>
  .container {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 1rem 0 2rem 0;
    background-color: lightblue;
    margin-bottom: -20rem;
  }

  h1 {
    color: darkgray;
    font-size: 1.8rem;
    font-weight: 300;
    padding-bottom: 1rem;
  }

  .complete {
    background-color: white;
    border-radius: 1.5rem;
    padding: 2rem;
    box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.1);
    max-width: 500px;
    width: 100%;
  }

  #terms {
    color: darkgray;
    font-size: 0.8rem;
    padding-left: 2rem;
    display: flex;
    flex-direction: row;
    gap: 0.2rem;
    margin-top: -2.4rem;
    padding-bottom: 1rem;
    position: relative;
    z-index: 1;
    pointer-events: none;

    @media (max-width: 768px) {
      flex-direction: column;
    }
  }

  #terms a {
    pointer-events: auto;
    text-decoration: none;
    color: green;
  }
</style>
